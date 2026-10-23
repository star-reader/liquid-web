/** Keep animation scheduling local; never replace the host page's APIs. */
export function createAnimationFrameScheduler(targetWindow) {
  if (
    typeof targetWindow.requestAnimationFrame === 'function' &&
    typeof targetWindow.cancelAnimationFrame === 'function'
  ) {
    return {
      request: targetWindow.requestAnimationFrame.bind(targetWindow),
      cancel: targetWindow.cancelAnimationFrame.bind(targetWindow),
    };
  }

  // Older environments need a matching request/cancel pair and a timestamp.
  return {
    request: (callback) => targetWindow.setTimeout(() => {
      const timestamp = targetWindow.performance?.now?.() ?? Date.now();
      callback(timestamp);
    }, 16),
    cancel: (handle) => targetWindow.clearTimeout(handle),
  };
}
