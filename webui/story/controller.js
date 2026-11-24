/** Story RPC orchestration. No progress is cached or synthesized in the browser. */
export function createStoryController(ctx, onChange = () => {}, environment = {}) {
  const doc = environment.document ?? globalThis.document;
  const win = environment.window ?? globalThis.window;
  const state = {
    snapshot: null, loading: true, busy: '', error: '', notice: '', reason: '', dmBusy: false,
    autoRunning: false, autoAuthorized: false, autoplay: false, recovering: false, ready: false,
  };
  let mounted = !ctx.signal?.aborted;
  let generation = 0;
  let requestVersion = 0;
  let autoJob = null;
  let modeJob = null;
  let mutationJob = null;
  let pauseJob = null;
  const hidden = () => doc?.visibilityState === 'hidden';
  const alive = () => mounted && !ctx.signal?.aborted;
  const emit = () => { if (alive()) onChange(state); };
  const trip = () => state.snapshot?.trip;
  const token = () => state.snapshot?.autonomy?.token;
  const description = (error) => typeof error === 'string' ? error : error?.message ?? '请求未完成，请重新读取实际进度。';
  const waits = new Set();
  const invalidate = () => { generation += 1; state.autoAuthorized = false; for (const cancel of [...waits]) cancel(); };
  function pace() {
    const ms = environment.pacingMs ?? 650;
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      let timer;
      const finish = () => { waits.delete(finish); timer?.dispose(); resolve(); };
      waits.add(finish);
      if (ctx.timeout) timer = ctx.timeout(finish, ms);
      else { const id = setTimeout(finish, ms); timer = { dispose: () => clearTimeout(id) }; }
    });
  }
  const same = (identity) => alive() && !hidden() && state.autoAuthorized
    && generation === identity.generation && trip()?.id === identity.id
    && trip()?.stamp === identity.stamp && token() === identity.token
    && state.snapshot?.autonomy?.enabled === true;

  async function call(method, payload, opts = {}) {
    if (typeof ctx.storyCall !== 'function') throw new Error('故事面板尚未连接调用适配器，请提供 ctx.storyCall。');
    const result = await ctx.storyCall(method, payload, {
      timeoutMs: ['decide', 'dmPropose', 'improvise'].includes(method) ? 45000 : 20000,
      ...(opts.keepalive ? {} : { signal: ctx.signal }), ...opts,
    });
    if (!result || result.ok !== true) throw new Error(description(result?.error ?? '服务没有返回可确认的结果。'));
    return result;
  }
  function apply(snapshot) {
    // A late request must not replace authoritative state after another operation.
    if (!snapshot || !Object.hasOwn(snapshot, 'trip') || !snapshot.autonomy) {
      throw new Error('故事状态不完整，请重新读取实际进度。');
    }
    state.snapshot = snapshot;
    state.ready = true;
    state.autoplay = snapshot.autoplay === true;
    if (!snapshot.trip || snapshot.trip.state !== 'active' || !snapshot.autonomy.enabled) state.autoAuthorized = false;
  }
  function identityPayload() {
    const current = trip();
    if (!current || current.stamp === undefined || current.stamp === null) throw new Error('缺少行程版本，请先刷新进度。');
    return { tripId: current.id, stamp: current.stamp };
  }

  // Pause is a cancellation, never a replay of an uncertain story action.
  async function pause(reason = '', quiet = false) {
    invalidate();
    if (reason) state.notice = reason;
    state.autoRunning = false;
    const current = trip();
    const currentToken = token();
    if (!current || !currentToken) { emit(); return; }
    if (pauseJob) { emit(); return pauseJob; }
    const version = ++requestVersion;
    const job = (async () => {
      try {
        const snapshot = await call('pause', { tripId: current.id, token: currentToken }, { keepalive: true });
        if (alive() && version === requestVersion) apply(snapshot);
      } catch (error) {
        if (alive() && !quiet) state.error = `暂停未获确认：${description(error)} 请刷新核对。`;
      } finally {
        if (pauseJob === job) pauseJob = null;
        emit();
      }
    })();
    pauseJob = job;
    emit();
    return job;
  }

  /**
   * 「鱼自己游玩」是一次持久偏好：只要还开着、又不是用户回合，就自动把授权续上，
   * 不用每次轮到她都手点。租约仍然由服务端在校验，切走页面只是暂停当下。
   */
  function maybeResume() {
    if (!alive() || hidden() || !state.ready || state.recovering || !state.autoplay) return;
    if (modeJob || mutationJob || autoJob) return;
    const current = trip();
    if (!current || current.state !== 'active' || current.step === 'blocked' || current.actor === 'owner') return;
    if (state.snapshot?.autonomy?.stop) {
      // 这一段确实走不动了：别反复尝试开启，直接把原因说出来，等用户点「再来一段」或自己选。
      if (!state.notice) { state.notice = state.snapshot.autonomy.reason ?? '这一段已经走完，等你决定下一步。'; emit(); }
      return;
    }
    if (state.snapshot?.autonomy?.enabled && state.autoAuthorized) return;
    void setMode(true);
  }

  async function refresh({ initial = false } = {}) {
    if (!alive() || state.loading && !initial || mutationJob || modeJob) return;
    invalidate();
    const version = ++requestVersion;
    state.loading = true;
    state.error = '';
    state.reason = '';
    emit();
    try {
      const snapshot = await call('status');
      if (!alive() || version !== requestVersion) return;
      apply(snapshot);
      // Reopening never silently resumes a server-side mode left enabled.
      if (snapshot.autonomy.enabled) await pause('已读取真实进度。自主游玩已暂停，继续前请明确开启。');
      maybeResume();
    } catch (error) {
      if (alive() && version === requestVersion) { state.error = description(error); state.ready = false; }
    } finally {
      if (alive() && version === requestVersion || alive() && !state.autoAuthorized) {
        state.loading = false;
        emit();
      }
    }
  }

  async function recover(error) {
    invalidate();
    state.recovering = true;
    state.ready = false;
    state.error = `操作未获确认：${description(error)} 不会自动重试，正在核对实际进度。`;
    emit();
    await pause('', true);
    if (!alive()) return;
    const version = ++requestVersion;
    try {
      const snapshot = await call('status');
      if (!alive() || version !== requestVersion) return;
      apply(snapshot);
      if (snapshot.autonomy.enabled) await pause('自主游玩已暂停，请核对最新记录后再操作。');
      state.notice = '已重新读取实际进度；请核对发生过的事件，再决定下一步。';
    } catch (statusError) {
      if (alive()) state.error += ` 读取失败：${description(statusError)}`;
    } finally { state.recovering = false; emit(); }
  }

  async function runAuto() {
    if (autoJob || !alive() || hidden() || !state.autoAuthorized) return;
    const epoch = generation;
    const job = (async () => {
      let steps = 0;
      // Secondary local ceiling; the backend owns its authoritative budget.
      while (alive() && !hidden() && state.autoAuthorized && generation === epoch) {
        const autonomy = state.snapshot?.autonomy;
        if (steps >= Math.min(60, Math.max(4, Number(autonomy?.limit?.steps) || 24))) { await pause('已到达本窗口的安全步数上限，请查看进度后继续。'); break; }
        const current = trip();
        if (!current || current.state !== 'active' || !autonomy?.enabled || !autonomy.token) break;
        if (autonomy.stop) { await pause(autonomy.reason ?? '这一段的额度用完了，接下来可以亲自继续。'); break; }
        if (current.step === 'blocked' || current.blocked) {
          await pause('当前行程暂时受阻，请查看提示后亲自处理。'); break;
        }
        const identity = { generation, id: current.id, stamp: current.stamp, token: autonomy.token };
        state.autoRunning = true;
        state.busy = '鱼正在看一看';
        emit();
        try {
          let snapshot;
          if (current.step === 'say') {
            // 自由模式：一次自演 = 一次「她说这一句」+ 一次「主持演这一回合」，两次都是真实模型调用。
            state.busy = '鱼正在想一想';
            emit();
            const line = await call('improvise', { tripId: identity.id, stamp: identity.stamp, token: identity.token });
            if (!same(identity)) break;
            if (typeof line.say !== 'string' || !line.say || typeof line.ticket !== 'string') throw new Error('没有收到可核验的台词凭证。');
            state.reason = typeof line.reason === 'string' ? line.reason : '';
            emit();
            state.busy = '正在确认这一句';
            emit();
            snapshot = await call('say', { tripId: identity.id, stamp: identity.stamp, say: line.say,
              auto: true, token: identity.token, ticket: line.ticket });
          } else {
            let ticket;
            if (current.step === 'choose') {
              state.busy = '鱼正在想一想';
              emit();
              const decision = await call('decide', { ...identityPayload(), token: identity.token });
              // This check intentionally precedes applying any delayed decision snapshot.
              if (!same(identity)) break;
              if (decision.trip?.id !== identity.id || decision.trip?.stamp !== identity.stamp
                || decision.autonomy?.token !== identity.token || !decision.autonomy.enabled) {
                throw new Error('作决定期间实际进度或游玩模式已改变。');
              }
              if (!Object.hasOwn(decision, 'ticket') || decision.ticket == null) throw new Error('没有收到可核验的决定凭证。');
              ticket = decision.ticket;
              state.reason = typeof decision.reason === 'string' ? decision.reason : '';
              emit();
            }
            if (!same(identity)) break;
            state.busy = '正在确认这一步';
            emit();
            // Exactly one action, with the version and mode token seen before decide.
            snapshot = await call('auto', { tripId: identity.id, stamp: identity.stamp, token: identity.token,
              ...(ticket === undefined ? {} : { ticket }) });
          }
          if (!alive()) break;
          // An already-submitted action may finish after mode-off; read fresh state.
          if (!same(identity)) { await recover('模式已改变，正在确认已提交动作的结果。'); break; }
          apply(snapshot);
          steps += 1;
          emit();
          const next = trip();
          if (next?.actor === 'owner') {
            invalidate();
            state.notice = '轮到你选择；选完鱼会接着走。';
            break;
          }
          if (next && next.id === identity.id && next.stamp === identity.stamp && state.snapshot.autonomy.enabled) {
            throw new Error('操作后行程版本没有变化，已停止继续推进。');
          }
          if (!next || next.state !== 'active') { invalidate(); state.notice = '这一趟已收好，可以去回忆里翻看。'; break; }
          // Leave a readable beat after confirmed state; invalidation cancels it.
          await pace();
          if (!alive() || hidden() || !state.autoAuthorized || generation !== epoch) break;
        } catch (error) {
          if (alive() && generation === identity.generation) await recover(error);
          break;
        } finally {
          state.autoRunning = false;
          if (!mutationJob && !modeJob) state.busy = '';
          emit();
        }
      }
    })();
    autoJob = job;
    try { await job; } finally { if (autoJob === job) autoJob = null; emit(); }
  }

  async function setMode(enabled) {
    // Invalidate synchronously, before waiting on any network operation.
    if (!enabled) { invalidate(); state.autoRunning = false; }
    if (!alive() || modeJob || mutationJob || !state.ready || state.recovering) { emit(); return; }
    const current = trip();
    if (!current || current.state !== 'active') return;
    if (enabled && state.snapshot?.autonomy?.stop) {
      // 这一段已经走不动了：不再发一次注定失败的开启请求，把真实原因留在提示里。
      state.notice = state.snapshot.autonomy.reason ?? '这一段的额度用完了，可以先「再来一段」。';
      emit();
      return;
    }
    if (enabled && (!state.snapshot.autonomy.available || hidden() || autoJob)) return;
    const requestedGeneration = ++generation;
    state.autoAuthorized = false;
    state.error = '';
    state.notice = enabled ? '' : '已接管，未提交的自动决定已作废。';
    state.busy = enabled ? '正在开启自主游玩' : '正在关闭自主游玩';
    const job = (async () => {
      try {
        const snapshot = await call('mode', { ...identityPayload(), enabled,
          ...(token() ? { token: token() } : {}) });
        if (!alive() || generation !== requestedGeneration || hidden()) {
          // A hidden/unmounted panel must revoke a mode enabled by a late response.
          if (snapshot.autonomy?.token && snapshot.trip) {
            await call('pause', { tripId: snapshot.trip.id, token: snapshot.autonomy.token }, { keepalive: true });
          }
          return;
        }
        ++requestVersion;
        apply(snapshot);
        state.autoAuthorized = enabled && snapshot.autonomy.enabled === true;
        if (enabled && !state.autoAuthorized) state.notice = snapshot.autonomy.reason ?? '自主游玩没有开启。';
      } catch (error) { if (alive()) await recover(error); }
      finally {
        if (modeJob === job) modeJob = null;
        state.busy = '';
        emit();
      }
    })();
    modeJob = job;
    emit();
    await job;
    if (state.autoAuthorized) void runAuto();
  }

  /**
   * 「再来一段」：只在页面服务端说 canContinue 时才发；重置的是这一段的步数与决定次数，
   * 段号与已经发生的记录都不变。之后若「鱼自己游玩」还开着，就接着自动走。
   */
  async function continueSegment() {
    if (!alive() || hidden() || !state.ready || state.recovering || state.busy || mutationJob || modeJob) return;
    const autonomy = state.snapshot?.autonomy;
    const free = trip()?.free;
    if (!autonomy?.canContinue && !free?.canContinue) return;
    invalidate();
    const operationGeneration = generation;
    state.error = '';
    state.notice = '';
    state.busy = '正在开新的一段';
    emit();
    const job = (async () => {
      try {
        const snapshot = await call('segment', { ...identityPayload(), confirm: true });
        if (!alive()) return;
        if (operationGeneration !== generation) { await recover('窗口状态已改变。'); return; }
        ++requestVersion;
        apply(snapshot);
        const freeSegment = snapshot.trip?.free?.segment;
        state.notice = Number.isInteger(freeSegment)
          ? `第 ${freeSegment} 段：这一段又有 ${snapshot.trip?.free?.maxTurns} 回合。`
          : snapshot.autonomy?.segment ? `第 ${snapshot.autonomy.segment} 段：步数和决定次数都重新计。` : '已开新的一段。';
      } catch (error) { if (alive()) await recover(error); }
      finally {
        if (mutationJob === job) mutationJob = null;
        state.busy = '';
        emit();
      }
    })();
    mutationJob = job;
    emit();
    await job;
    if (state.autoplay && !state.recovering) await setMode(true);
  }

  /** 鱼这一步没法自己决定时，由用户显式替她选；回执会记 substituted。 */
  async function substitute(optionId) {
    const current = trip();
    if (!current?.pending || current.step !== 'choose' || !state.snapshot?.autonomy?.canSubstitute) return;
    return mutate('choose', { choiceId: current.pending.id, optionId, substitute: true, confirm: true });
  }

  async function fork(memoryId, checkpointId) {
    if (!alive() || !state.ready || trip() || state.busy || state.recovering || !memoryId || !checkpointId) return false;
    const forkToken = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    state.error = ''; state.notice = ''; state.busy = '正在从检查点创建隔离分支'; emit();
    try {
      const snapshot = await call('fork', { memoryId, checkpointId, forkToken });
      if (!alive()) return false;
      apply(snapshot);
      state.notice = '已从已验证检查点创建新 runId。源回忆与预算保留；此分支不写入正史探索、心愿或收藏。';
      // 调用方（面板）据此决定要不要直接跳到「出游」；没建出新行程就留在原地看错误。
      return Boolean(snapshot?.trip);
    } catch (error) {
      if (alive()) state.error = description(error);
      return false;
    } finally { state.busy = ''; emit(); }
  }

  async function mutate(method, extra = {}) {
    if (!alive() || !state.ready || hidden() || state.loading || state.recovering
      || mutationJob || modeJob || state.autoAuthorized) return;
    invalidate();
    const operationGeneration = generation;
    state.error = '';
    state.notice = '';
    state.reason = '';
    state.busy = '正在保存';
    const job = (async () => {
      try {
        let payload = extra;
        if (['move', 'resume', 'close', 'choose', 'say', 'rewind'].includes(method)) payload = { ...identityPayload(), ...extra };
        if (method === 'start') payload = { ...extra, startStamp: state.snapshot.startStamp };
        const snapshot = await call(method, payload);
        if (!alive()) return;
        if (operationGeneration !== generation) { await recover('窗口状态已改变。'); return; }
        ++requestVersion;
        apply(snapshot);
        state.notice = method === 'close' ? '这趟经历已收进回忆。' : snapshot.lastSay?.note ?? '';
        maybeResume();
      } catch (error) { if (alive()) await recover(error); }
      finally {
        if (mutationJob === job) mutationJob = null;
        state.busy = '';
        emit();
      }
    })();
    mutationJob = job;
    emit();
    return job;
  }

  let dmGeneration = 0;
  async function cancelDM(quiet = false) {
    ++dmGeneration;
    const current = trip();
    const version = requestVersion;
    const wasBusy = state.dmBusy;
    state.dmBusy = false;
    emit();
    if (!current || !wasBusy && !state.snapshot?.dm?.pending && !state.snapshot?.dm?.proposal && !quiet) return;
    try {
      const snapshot = await call('dmCancel', {}, { keepalive: true });
      if (alive() && version === requestVersion && trip()?.stamp === current.stamp) apply(snapshot);
    } catch (error) { if (alive() && !quiet) state.error = description(error); }
    emit();
  }
  async function proposeDM() {
    const current = trip();
    if (!alive() || hidden() || !state.ready || state.dmBusy || state.busy || state.autoAuthorized
      || state.snapshot?.autonomy?.enabled || !state.snapshot?.dm?.enabled || !state.snapshot?.dm?.available
      || current?.state !== 'active' || current.step !== 'choose') return;
    const identity = { ...identityPayload(), epoch: generation, dmEpoch: ++dmGeneration };
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}-${Math.random().toString(36).slice(2, 8)}`;
    state.dmBusy = true; state.error = ''; emit();
    try {
      const snapshot = await call('dmPropose', { tripId: identity.tripId, stamp: identity.stamp, requestId });
      if (!alive() || hidden() || identity.epoch !== generation || identity.dmEpoch !== dmGeneration
        || trip()?.id !== identity.tripId || trip()?.stamp !== identity.stamp) return;
      apply(snapshot);
    } catch (error) {
      if (alive() && identity.epoch === generation && identity.dmEpoch === dmGeneration) state.error = description(error);
    } finally {
      if (identity.dmEpoch === dmGeneration) state.dmBusy = false;
      emit();
    }
  }
  async function applyDM() {
    const current = trip();
    const proposal = state.snapshot?.dm?.proposal;
    if (!proposal || proposal.stamp !== current?.stamp || current.actor === 'fish') return;
    return mutate('choose', { choiceId: current.pending.id, optionId: proposal.optionId, dmProposalId: proposal.id });
  }

  const onHide = () => { if (hidden()) { void cancelDM(true); void pause('窗口已隐藏，自主游玩已暂停。'); } };
  const onPageHide = () => { void cancelDM(true); void pause('窗口已离开，自主游玩已暂停。'); };
  const onVisible = () => { if (!hidden() && alive()) void refresh(); };
  function dispose() {
    if (!mounted) return;
    // Calling pause before marking unmounted still allows a keepalive cleanup call.
    void cancelDM(true);
    void pause('', true);
    mounted = false;
    ++requestVersion;
    doc?.removeEventListener('visibilitychange', onHide);
    doc?.removeEventListener('visibilitychange', onVisible);
    win?.removeEventListener('pagehide', onPageHide);
    ctx.signal?.removeEventListener('abort', dispose);
  }
  doc?.addEventListener('visibilitychange', onHide);
  doc?.addEventListener('visibilitychange', onVisible);
  win?.addEventListener('pagehide', onPageHide);
  ctx.signal?.addEventListener('abort', dispose, { once: true });
  void refresh({ initial: true });
  return { state, refresh, mutate, setMode, pause, fork, continueSegment, substitute, proposeDM, cancelDM, applyDM, dispose };
}
