// audio.js — nhạc DJ cho cảnh bar: synth WebAudio theo đoạn (warm-up /
// build / drop) + âm thanh DJ pad + chạy track file tùy chọn.
// KHÔNG dùng nhạc có bản quyền. Mọi pattern/âm lượng/BPM đọc từ config.js.
//
// Interface giữ nguyên cho main.js: unlock(), start(), stop(), toggle(),
// music.playing, CONFIG.music.startOnUnlock. Thêm: setMode(), playTrack(),
// loadTracks(), triggerPad(), onBeat / onSectionChange (callback tùy chọn),
// currentSectionId. Cần 1 chạm của người dùng để unlock AudioContext:
// main.js gọi music.unlock() trong handler nút "Bắt đầu".

import { CONFIG } from '../config.js';

const STEPS_PER_BAR = 16;

export class MusicEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.delaySend = null;
    this.playing = false;
    // Chế độ mặc định: 'file' khi có track trong CONFIG (rớt về synth nếu
    // nạp thất bại), ngược lại 'synth'. Đọc CONFIG.music.defaultMode.
    this.mode = (CONFIG.music.defaultMode === 'file' && (CONFIG.music.tracks || []).length > 0)
      ? 'file'
      : 'synth';
    this.timerId = null;
    this.step = 0;
    this.nextStepTime = 0;
    this.sectionIndex = 0;
    this.barInSection = 0;
    this.beatCount = 0;
    this.riserScheduledForBar = -1;
    // Chu kỳ scheduler (giây) — đủ nhỏ để nhịp đều, đủ lớn để máy yếu đỡ tốn.
    this.lookaheadSeconds = 0.12;
    this.timerIntervalMs = 40;
    // Callback tùy chọn: onBeat(beatCount, audioTime), onSectionChange(id).
    this.onBeat = null;
    this.onSectionChange = null;
    // Track file: buffer đã decode theo index trong CONFIG.music.tracks.
    this.trackBuffers = new Map();
    this.trackSource = null;
    this.fileGain = null;
    // Playlist đẩy liên tục (file mode): hàng đợi + crossfade + beat timer.
    this.onTrackChange = null;
    this.trackOrder = [];
    this.trackPos = 0;
    this.trackIndex = -1;
    this.trackStartTime = 0;
    this.trackBpm = CONFIG.music.bpm;
    this.trackSourceGain = null;
    this.nextSource = null;
    this.nextSourceGain = null;
    this.nextTimerId = null;
    this.beatTimerId = null;
    this.fileBeatCount = 0;
    this._pendingNext = null;
    this._nextOrder = null;
    this._loadPromise = null;
    this._startToken = 0;
  }

  get stepDurationSeconds() {
    return 60 / CONFIG.music.bpm / 4;
  }

  get barDurationSeconds() {
    return this.stepDurationSeconds * STEPS_PER_BAR;
  }

  get currentSectionId() {
    const sections = CONFIG.music.sections || [];
    if (sections.length === 0) return '';
    return sections[this.sectionIndex % sections.length].id;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = CONFIG.music.masterVolume;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this._makeNoiseBuffer(2);
      // Delay dotted-8th chung cho arp: 1 node duy nhất, rẻ cho máy yếu.
      const delay = this.ctx.createDelay(1);
      delay.delayTime.value = this.stepDurationSeconds * 3;
      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.35;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.25;
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(this.master);
      this.delaySend = delay;
      this.fileGain = this.ctx.createGain();
      this.fileGain.gain.value = CONFIG.music.trackGain || 0.8;
      this.fileGain.connect(this.master);
      // Nạp track file nền ngay khi unlock để bấm "Bắt đầu" là có nhạc
      // file sẵn (không cần main.js gọi loadTracks). Thất bại thì im lặng
      // ở đây — lúc start() sẽ rớt về synth.
      if ((CONFIG.music.tracks || []).length > 0) {
        this._ensureTracksLoaded().catch(() => {});
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return true;
  }

  _makeNoiseBuffer(seconds) {
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  start() {
    if (!this.unlock()) return;
    if (this.playing) return;
    if (this.mode === 'file') {
      this._startFilePlaylist();
      return;
    }
    this._startSynth();
  }

  // File mode: chờ nạp track (nền) rồi chạy playlist không ngừng; nạp
  // thất bại hết thì rớt về synth, không im lặng.
  _startFilePlaylist() {
    const token = ++this._startToken;
    this.playing = true;
    this._ensureTracksLoaded().then(({ loaded }) => {
      if (token !== this._startToken || !this.playing) return;
      if (loaded === 0 || this.trackBuffers.size === 0) {
        this.mode = 'synth';
        this._startSynth();
        return;
      }
      this.trackOrder = this._buildOrder();
      this._nextOrder = null;
      this.trackPos = 0;
      this._playFileIndex(this.trackOrder[this.trackPos]);
    }).catch(() => {
      if (token !== this._startToken || !this.playing) return;
      this.mode = 'synth';
      this._startSynth();
    });
  }

  _startSynth() {
    this._stopFileSource();
    this.playing = true;
    this.step = 0;
    this.sectionIndex = 0;
    this.barInSection = 0;
    this.beatCount = 0;
    this.riserScheduledForBar = -1;
    this.nextStepTime = this.ctx.currentTime + 0.06;
    this.timerId = window.setInterval(() => this._schedule(), this.timerIntervalMs);
  }

  stop() {
    // Tăng token để mọi đường async đang chờ (nạp track, crossfade) hủy.
    this._startToken += 1;
    this.playing = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    this._stopFileSource();
  }

  toggle() {
    if (this.playing) this.stop();
    else this.start();
    return this.playing;
  }

  // Đổi chế độ nhạc: 'synth' (mặc định) hoặc 'file' (track trong CONFIG).
  setMode(mode) {
    if (mode !== 'synth' && mode !== 'file') return false;
    if (mode === 'file' && (!CONFIG.music.tracks || CONFIG.music.tracks.length === 0)) return false;
    const wasPlaying = this.playing;
    this.stop();
    this.mode = mode;
    if (wasPlaying) this.start();
    return true;
  }

  // Nạp track 1 lần duy nhất, dùng chung cho mọi đường gọi (tránh nạp
  // trùng khi unlock() + start() gọi cùng lúc). Promise.resolve().then
  // để việc gán _loadPromise xong trước khi loadTracks chạy — không thì
  // unlock() bên trong loadTracks sẽ đệ quy vô hạn.
  _ensureTracksLoaded() {
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = Promise.resolve().then(() => this.loadTracks());
    return this._loadPromise;
  }

  // Nạp + decode mọi track file trong CONFIG (trả về {loaded, failed}).
  async loadTracks() {
    if (!this.unlock()) return { loaded: 0, failed: (CONFIG.music.tracks || []).length };
    const tracks = CONFIG.music.tracks || [];
    let loaded = 0;
    let failed = 0;
    for (let i = 0; i < tracks.length; i += 1) {
      if (this.trackBuffers.has(i)) {
        loaded += 1;
        continue;
      }
      try {
        const resp = await fetch(tracks[i].src);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.arrayBuffer();
        const buffer = await this.ctx.decodeAudioData(data);
        this.trackBuffers.set(i, buffer);
        loaded += 1;
      } catch (err) {
        failed += 1;
        console.error('[MusicEngine] không nạp được track', i, err);
      }
    }
    return { loaded, failed };
  }

  // Nhảy tới 1 track cụ thể: đưa nó lên đầu hàng đợi, phần còn lại trộn
  // tiếp; phát ngay (đổi sang file mode nếu cần).
  async playTrack(index) {
    const tracks = CONFIG.music.tracks || [];
    if (!tracks[index]) return false;
    if (!this.unlock()) return false;
    await this._ensureTracksLoaded();
    if (!this.trackBuffers.has(index)) return false;
    this._startToken += 1;
    this.mode = 'file';
    this.playing = true;
    const rest = this._buildOrder().filter((i) => i !== index);
    this.trackOrder = [index, ...rest];
    this._nextOrder = null;
    this.trackPos = 0;
    this._playFileIndex(index);
    return true;
  }

  // Qua track kế trong hàng đợi (nút DJ sau này gọi). Trả false nếu
  // không ở file mode / không phát.
  nextTrack() {
    if (this.mode !== 'file' || !this.playing) return false;
    this._advanceFileQueue();
    return true;
  }

  get currentTrack() {
    const tracks = CONFIG.music.tracks || [];
    return tracks[this.trackIndex] || null;
  }

  // ---- Playlist đẩy liên tục (file mode) ----
  // Hàng đợi: track hot (hot: true) trộn trước, còn lại trộn sau; hết 1
  // vòng thì trộn lại — nhạc chạy nối tiếp không ngừng. Chuyển track bằng
  // crossfade đúng ranh giới bar (file nào cũng cắt đúng số bar nguyên).

  _buildOrder() {
    const tracks = CONFIG.music.tracks || [];
    const playable = tracks.map((t, i) => i).filter((i) => this.trackBuffers.has(i));
    const shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    const playlist = CONFIG.music.playlist || {};
    if (playlist.shuffle === false) return playable;
    if (playlist.hotFirst === false) return shuffle(playable);
    const hot = shuffle(playable.filter((i) => tracks[i].hot));
    const rest = shuffle(playable.filter((i) => !tracks[i].hot));
    return [...hot, ...rest];
  }

  // Tính trước hàng đợi vòng sau khi track hiện tại là track cuối vòng.
  _primeNextOrder() {
    if (this.trackPos >= this.trackOrder.length - 1 && !this._nextOrder) {
      this._nextOrder = this._buildOrder();
    }
  }

  _playFileIndex(index) {
    const buffer = this.trackBuffers.get(index);
    const track = (CONFIG.music.tracks || [])[index];
    if (!buffer || !track) {
      this._advanceFileQueue();
      return;
    }
    this._stopFileSource();
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = (typeof track.gain === 'number' ? track.gain : 1);
    src.connect(gain);
    gain.connect(this.fileGain);
    const startAt = this.ctx.currentTime + 0.05;
    src.start(startAt);
    this.trackSource = src;
    this.trackSourceGain = gain;
    this.trackIndex = index;
    this.trackStartTime = startAt;
    this.trackBpm = (typeof track.bpm === 'number' && track.bpm > 0)
      ? track.bpm
      : CONFIG.music.bpm;
    this.playing = true;
    this._primeNextOrder();
    if (typeof this.onTrackChange === 'function') {
      try {
        this.onTrackChange(index, track);
      } catch (err) {
        console.error('[MusicEngine] onTrackChange lỗi:', err);
      }
    }
    this._startFileBeatTimer();
    this._scheduleNext();
  }

  // Lên lịch chuyển track: crossfade trước khi track hiện tại hết, hoặc
  // nối tiếp ngay tại điểm hết nếu không crossfade.
  _scheduleNext() {
    this._clearNextTimer();
    const buffer = this.trackBuffers.get(this.trackIndex);
    if (!buffer) return;
    const playlist = CONFIG.music.playlist || {};
    const crossfade = typeof playlist.crossfadeSeconds === 'number'
      ? playlist.crossfadeSeconds
      : 0;
    const endTime = this.trackStartTime + buffer.duration;
    const token = this._startToken;
    if (crossfade > 0 && buffer.duration > crossfade + 0.2) {
      const fadeStart = endTime - crossfade;
      const delayMs = Math.max(0, (fadeStart - this.ctx.currentTime) * 1000);
      this.nextTimerId = window.setTimeout(() => {
        this.nextTimerId = null;
        if (token !== this._startToken || !this.playing) return;
        this._beginCrossfade(endTime, fadeStart);
      }, delayMs);
    } else {
      const delayMs = Math.max(0, (endTime - this.ctx.currentTime) * 1000);
      this.nextTimerId = window.setTimeout(() => {
        this.nextTimerId = null;
        if (token !== this._startToken || !this.playing) return;
        this._advanceFileQueue();
      }, delayMs);
    }
  }

  _peekNextIndex() {
    const nextPos = this.trackPos + 1;
    if (nextPos < this.trackOrder.length) {
      return { index: this.trackOrder[nextPos], fromWrap: false };
    }
    if (this._nextOrder && this._nextOrder.length > 0) {
      return { index: this._nextOrder[0], fromWrap: true };
    }
    return { index: -1, fromWrap: true };
  }

  _beginCrossfade(endTime, fadeStart) {
    const { index: nextIndex, fromWrap } = this._peekNextIndex();
    const buffer = this.trackBuffers.get(nextIndex);
    const track = (CONFIG.music.tracks || [])[nextIndex];
    if (nextIndex === -1 || !buffer || !track) {
      this._advanceFileQueue();
      return;
    }
    const now = Math.max(this.ctx.currentTime, fadeStart);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    const target = (typeof track.gain === 'number' ? track.gain : 1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(target, endTime);
    src.connect(gain);
    gain.connect(this.fileGain);
    src.start(now);
    if (this.trackSourceGain) {
      try {
        this.trackSourceGain.gain.setValueAtTime(this.trackSourceGain.gain.value, now);
        this.trackSourceGain.gain.linearRampToValueAtTime(0.0001, endTime);
      } catch (err) {
        // Gain node đã dừng — bỏ qua.
      }
    }
    this.nextSource = src;
    this.nextSourceGain = gain;
    this._pendingNext = { index: nextIndex, startTime: now, endTime, fromWrap };
    const token = this._startToken;
    const delayMs = Math.max(0, (endTime - this.ctx.currentTime) * 1000);
    this.nextTimerId = window.setTimeout(() => {
      this.nextTimerId = null;
      if (token !== this._startToken || !this.playing) return;
      this._promoteNext();
    }, delayMs);
  }

  _promoteNext() {
    const pending = this._pendingNext;
    this._pendingNext = null;
    if (this.trackSource) {
      try {
        this.trackSource.stop();
      } catch (err) {
        // Đã dừng rồi — bỏ qua.
      }
      try {
        this.trackSource.disconnect();
      } catch (err) {
        // Bỏ qua.
      }
    }
    if (this.trackSourceGain) {
      try {
        this.trackSourceGain.disconnect();
      } catch (err) {
        // Bỏ qua.
      }
    }
    this.trackSource = this.nextSource;
    this.trackSourceGain = this.nextSourceGain;
    this.nextSource = null;
    this.nextSourceGain = null;
    if (!pending) {
      this._advanceFileQueue();
      return;
    }
    if (pending.fromWrap) {
      this.trackOrder = (this._nextOrder && this._nextOrder.length > 0)
        ? this._nextOrder
        : this._buildOrder();
      this._nextOrder = null;
      this.trackPos = 0;
    } else {
      this.trackPos += 1;
    }
    this.trackIndex = pending.index;
    this.trackStartTime = pending.startTime;
    const track = (CONFIG.music.tracks || [])[pending.index];
    this.trackBpm = (track && typeof track.bpm === 'number' && track.bpm > 0)
      ? track.bpm
      : CONFIG.music.bpm;
    this._primeNextOrder();
    if (typeof this.onTrackChange === 'function') {
      try {
        this.onTrackChange(pending.index, track);
      } catch (err) {
        console.error('[MusicEngine] onTrackChange lỗi:', err);
      }
    }
    this._startFileBeatTimer();
    this._scheduleNext();
  }

  _advanceFileQueue() {
    const nextPos = this.trackPos + 1;
    if (nextPos < this.trackOrder.length) {
      this.trackPos = nextPos;
      this._playFileIndex(this.trackOrder[this.trackPos]);
      return;
    }
    this.trackOrder = (this._nextOrder && this._nextOrder.length > 0)
      ? this._nextOrder
      : this._buildOrder();
    this._nextOrder = null;
    if (this.trackOrder.length === 0) {
      // Không còn track nào phát được → quay về synth, không im lặng.
      this.mode = 'synth';
      this._startSynth();
      return;
    }
    this.trackPos = 0;
    this._playFileIndex(this.trackOrder[0]);
  }

  // Beat timer cho file mode: đèn ăn theo nhịp của chính track đang chạy
  // (BPM riêng từng track), giống onBeat của synth. Rẻ: 1 interval 25ms.
  _startFileBeatTimer() {
    this._stopFileBeatTimer();
    const beatDur = 60 / this.trackBpm;
    this.fileBeatCount = Math.max(
      0,
      Math.floor((this.ctx.currentTime - this.trackStartTime) / beatDur),
    );
    this.beatTimerId = window.setInterval(() => {
      if (!this.playing || this.mode !== 'file' || !this.ctx) return;
      const elapsed = this.ctx.currentTime - this.trackStartTime;
      const count = Math.floor(elapsed / beatDur);
      while (this.fileBeatCount < count) {
        this.fileBeatCount += 1;
        if (typeof this.onBeat === 'function') {
          try {
            this.onBeat(this.fileBeatCount, this.trackStartTime + this.fileBeatCount * beatDur);
          } catch (err) {
            console.error('[MusicEngine] onBeat lỗi:', err);
          }
        }
      }
    }, 25);
  }

  _stopFileBeatTimer() {
    if (this.beatTimerId !== null) {
      window.clearInterval(this.beatTimerId);
      this.beatTimerId = null;
    }
  }

  _clearNextTimer() {
    if (this.nextTimerId !== null) {
      window.clearTimeout(this.nextTimerId);
      this.nextTimerId = null;
    }
  }

  _stopFileSource() {
    this._clearNextTimer();
    this._stopFileBeatTimer();
    this._pendingNext = null;
    const sources = [this.trackSource, this.nextSource];
    for (const src of sources) {
      if (src) {
        try {
          src.stop();
        } catch (err) {
          // Đã dừng rồi — bỏ qua.
        }
        try {
          src.disconnect();
        } catch (err) {
          // Bỏ qua.
        }
      }
    }
    this.trackSource = null;
    this.nextSource = null;
    for (const g of [this.trackSourceGain, this.nextSourceGain]) {
      if (g) {
        try {
          g.disconnect();
        } catch (err) {
          // Bỏ qua.
        }
      }
    }
    this.trackSourceGain = null;
    this.nextSourceGain = null;
  }

  _currentSection() {
    const sections = CONFIG.music.sections || [];
    if (sections.length === 0) return null;
    return sections[this.sectionIndex % sections.length];
  }

  _advanceSectionIfNeeded() {
    if (!CONFIG.music.autoSections) return;
    const sections = CONFIG.music.sections || [];
    if (sections.length === 0) return;
    const current = sections[this.sectionIndex % sections.length];
    if (this.barInSection < current.bars) return;
    this.barInSection = 0;
    const nextIndex = this.sectionIndex + 1;
    if (nextIndex >= sections.length) {
      this.sectionIndex = CONFIG.music.loopFromSection || 0;
    } else {
      this.sectionIndex = nextIndex;
    }
    const next = sections[this.sectionIndex % sections.length];
    if (typeof this.onSectionChange === 'function') {
      try {
        this.onSectionChange(next.id);
      } catch (err) {
        console.error('[MusicEngine] onSectionChange lỗi:', err);
      }
    }
    // Vào đoạn drop: impact nổ đúng downbeat (đã có tiếng riser trước đó).
    if (next.id === 'drop' && this.playing) {
      this.playImpact(this.nextStepTime);
    }
  }

  _schedule() {
    if (!this.ctx || !this.playing) return;
    if (this.mode !== 'synth') return;
    while (this.nextStepTime < this.ctx.currentTime + this.lookaheadSeconds) {
      const stepInBar = this.step % STEPS_PER_BAR;
      if (stepInBar === 0) {
        this._advanceSectionIfNeeded();
        this._onBarStart(this.nextStepTime);
      }
      const section = this._currentSection();
      if (section) this._playStep(section, stepInBar, this.nextStepTime);
      if (stepInBar % 4 === 0 && typeof this.onBeat === 'function') {
        try {
          this.onBeat(this.beatCount, this.nextStepTime);
        } catch (err) {
          console.error('[MusicEngine] onBeat lỗi:', err);
        }
        this.beatCount += 1;
      }
      this.nextStepTime += this.stepDurationSeconds;
      this.step += 1;
      if (stepInBar === STEPS_PER_BAR - 1) this.barInSection += 1;
    }
  }

  // Đầu mỗi bar: hợp âm pad (warm-up) + riser cuối đoạn build.
  _onBarStart(when) {
    const section = this._currentSection();
    if (!section) return;
    const barNumber = this.barInSection;
    if (section.padChords && section.padChords.length > 0) {
      const chord = section.padChords[barNumber % section.padChords.length];
      this._padChord(chord, when, this.barDurationSeconds);
    }
    const riserBars = section.riserLastBars || 0;
    if (riserBars > 0 && barNumber === section.bars - riserBars) {
      const globalBar = this.step / STEPS_PER_BAR;
      if (this.riserScheduledForBar !== globalBar) {
        this.riserScheduledForBar = globalBar;
        this.playRiser(when, riserBars * this.barDurationSeconds);
      }
    }
  }

  _playStep(section, stepIndex, when) {
    if (section.kickSteps && section.kickSteps.includes(stepIndex)) this._kick(when);
    if (section.snareSteps && section.snareSteps.includes(stepIndex)) this._snare(when);
    if (section.hatSteps && section.hatSteps.includes(stepIndex)) this._hat(when, false);
    if (section.openHatSteps && section.openHatSteps.includes(stepIndex)) this._hat(when, true);
    const bassFreq = section.bassPattern ? section.bassPattern[stepIndex] : 0;
    if (bassFreq) this._bass(bassFreq, when);
    const arpFreq = section.arpPattern ? section.arpPattern[stepIndex] : 0;
    if (arpFreq) this._arp(arpFreq, when);
  }

  _kick(when) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, when);
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.12);
    gain.gain.setValueAtTime(CONFIG.music.kickVolume, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + 0.25);
    // Click transient: burst noise rất ngắn qua highpass, cho kick đanh.
    const click = this.ctx.createBufferSource();
    click.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(CONFIG.music.kickVolume * 0.25, when);
    clickGain.gain.exponentialRampToValueAtTime(0.001, when + 0.02);
    click.connect(hp);
    hp.connect(clickGain);
    clickGain.connect(this.master);
    click.start(when);
    click.stop(when + 0.03);
  }

  _snare(when) {
    // Thân snare: noise qua bandpass + osc tam giác 190Hz.
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(CONFIG.music.snareVolume, when);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
    noise.connect(bp);
    bp.connect(noiseGain);
    noiseGain.connect(this.master);
    noise.start(when);
    noise.stop(when + 0.2);
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 190;
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(CONFIG.music.snareVolume * 0.6, when);
    oscGain.gain.exponentialRampToValueAtTime(0.001, when + 0.1);
    osc.connect(oscGain);
    oscGain.connect(this.master);
    osc.start(when);
    osc.stop(when + 0.12);
  }

  _bass(freq, when) {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    // Lọc lowpass quét xuống theo nốt: bass ấm, không chói.
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, when);
    filter.frequency.exponentialRampToValueAtTime(220, when + this.stepDurationSeconds * 0.9);
    filter.Q.value = 4;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(CONFIG.music.bassVolume, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + this.stepDurationSeconds * 0.9);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + this.stepDurationSeconds);
  }

  _hat(when, open) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = this.ctx.createGain();
    const decay = open ? 0.28 : 0.05;
    const vol = open ? CONFIG.music.openHatVolume : CONFIG.music.hatVolume;
    gain.gain.setValueAtTime(vol, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + decay);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(when);
    src.stop(when + decay + 0.02);
  }

  _arp(freq, when) {
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(CONFIG.music.arpVolume, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + this.stepDurationSeconds * 0.9);
    osc.connect(gain);
    gain.connect(this.master);
    if (this.delaySend) gain.connect(this.delaySend);
    osc.start(when);
    osc.stop(when + this.stepDurationSeconds);
  }

  _padChord(freqs, when, durationSeconds) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;
    const gain = this.ctx.createGain();
    const vol = CONFIG.music.padVolume;
    gain.gain.setValueAtTime(0.001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(vol, 0.001), when + 0.4);
    gain.gain.setValueAtTime(Math.max(vol, 0.001), when + Math.max(0.4, durationSeconds - 0.4));
    gain.gain.exponentialRampToValueAtTime(0.001, when + durationSeconds);
    filter.connect(gain);
    gain.connect(this.master);
    freqs.forEach((freq, i) => {
      [-5, 5].forEach((detune) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(when);
        osc.stop(when + durationSeconds + 0.05);
      });
    });
  }

  // ---- DJ pad sounds: gọi tay từ scene (gift lớn / nút DJ sau này) ----

  // Dispatcher: triggerPad('riser' | 'impact' | 'airhorn' | 'siren').
  // Trả về false nếu audio chưa unlock.
  triggerPad(name, when) {
    if (!this.ctx) return false;
    const t = typeof when === 'number' ? when : this.ctx.currentTime + 0.01;
    if (name === 'riser') return this.playRiser(t);
    if (name === 'impact') return this.playImpact(t);
    if (name === 'airhorn') return this.playAirhorn(t);
    if (name === 'siren') return this.playSiren(t);
    return false;
  }

  // Riser: noise qua bandpass quét lên + gain dâng. `when` có thể là thời
  // điểm AudioContext (để lên lịch trước) hoặc duration nếu gọi 1 đối số.
  playRiser(when, durationSeconds) {
    if (!this.ctx) return false;
    let t = this.ctx.currentTime + 0.01;
    // Mặc định riser dài 2 bar khi gọi tay không kèm duration.
    let dur = this.barDurationSeconds * 2;
    if (typeof when === 'number') t = when;
    if (typeof durationSeconds === 'number' && durationSeconds > 0) dur = durationSeconds;
    dur = Math.max(0.2, dur);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(6000, t + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(CONFIG.music.pads.riserVolume, 0.001), t + dur);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.1);
    return true;
  }

  playImpact(when) {
    if (!this.ctx) return false;
    const t = typeof when === 'number' ? when : this.ctx.currentTime + 0.01;
    // Boom trầm: sine 110 → 32Hz.
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.5);
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(CONFIG.music.pads.impactVolume, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(oscGain);
    oscGain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.65);
    // Crash: noise qua lowpass, tắt dần.
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 9000;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(CONFIG.music.pads.impactVolume * 0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    noise.connect(lp);
    lp.connect(noiseGain);
    noiseGain.connect(this.master);
    noise.start(t);
    noise.stop(t + 0.45);
    return true;
  }

  playAirhorn(when) {
    if (!this.ctx) return false;
    const t = typeof when === 'number' ? when : this.ctx.currentTime + 0.01;
    const dur = CONFIG.music.pads.airhornSeconds || 0.9;
    // Stack saw hơi lệch nhau — tiếng còi hơi chói đặc trưng.
    const freqs = [415.3, 466.16, 554.37];
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(CONFIG.music.pads.airhornVolume, 0.001),
      t + 0.05,
    );
    gain.gain.setValueAtTime(Math.max(CONFIG.music.pads.airhornVolume, 0.001), t + dur - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    gain.connect(this.master);
    freqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = (i - 1) * 6;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    });
    return true;
  }

  playSiren(when) {
    if (!this.ctx) return false;
    const t = typeof when === 'number' ? when : this.ctx.currentTime + 0.01;
    const dur = CONFIG.music.pads.sirenSeconds || 1.6;
    const carrier = this.ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = 900;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1.5;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain);
    lfoGain.connect(carrier.frequency);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(CONFIG.music.pads.sirenVolume, 0.001),
      t + 0.1,
    );
    gain.gain.setValueAtTime(Math.max(CONFIG.music.pads.sirenVolume, 0.001), t + dur - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    carrier.connect(gain);
    gain.connect(this.master);
    carrier.start(t);
    carrier.stop(t + dur + 0.05);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    return true;
  }
}
