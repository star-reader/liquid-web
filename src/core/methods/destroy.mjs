import LiquidWeb from '../core.mjs';

export default {
  destroy() {
    if (this.destroyed) return;

    this.emit('beforeDestroy');

    this.destroyed = true;
    this._updateGeneration += 1;
    for (const frameId of this._pendingUpdates) {
      this._animationFrame.cancel(frameId);
    }
    this._pendingUpdates.clear();
    this.detachEventListeners();

    this.$svg?.remove();
    this.$svg = null;
    this.$backdrop?.remove();
    this.$backdrop = null;
    if (this.$content) {
      if (this.$content.liquidweb === this) delete this.$content.liquidweb;
      this.$el?.appendChild?.(this.$content);
    }
    this.$el?.querySelector('.liquidweb__content')?.remove();
    this.$el?.classList.remove('liquidweb');
    this.$el?.classList.remove('liquidweb-initialized');

    // Отключаем MutationObserver
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }

    this.emit('destroy');

    // Очищаем экземпляр
    if (this.$el) {
      LiquidWeb.__instances__.delete(this.$el);
      delete this.$el.liquidweb;
    }

    this.eventsListeners = {};
    this.eventsAnyListeners = [];
    this.initialized = false;
    this.destroyed = true;

    this.emit('afterDestroy');

    return null;
  },
};
