/**
 * Debug overlay — toggled with G key.
 * Shows all layers, emitters, objects with their parameters.
 */
export class DebugOverlay {
  constructor(element, aquariumScene) {
    this.el = element;
    this.scene = aquariumScene;
    this.visible = false;
    this._interval = null;
  }

  toggle() {
    this.visible = !this.visible;
    this.el.classList.toggle('hidden', !this.visible);

    if (this.visible) {
      this._update();
      this._interval = setInterval(() => this._update(), 500);
    } else {
      clearInterval(this._interval);
    }
  }

  _update() {
    const systems = this.scene.getSystems();
    let html = '';

    for (const [key, system] of Object.entries(systems)) {
      if (!system.getDebugInfo) continue;
      const info = system.getDebugInfo();
      html += this._renderSection(info);
    }

    // FPS
    html += `<div class="debug-section"><h4>Renderer</h4>`;
    const ri = this.scene.renderer.info;
    html += `<div>Triangles: ${ri.render.triangles}</div>`;
    html += `<div>Draw calls: ${ri.render.calls}</div>`;
    html += `<div>Textures: ${ri.memory.textures}</div>`;
    html += `<div>Geometries: ${ri.memory.geometries}</div>`;
    html += `</div>`;

    this.el.innerHTML = html;
  }

  _renderSection(info) {
    let html = `<div class="debug-section"><h4>${info.name}</h4>`;

    // Params
    if (info.params) {
      for (const [k, v] of Object.entries(info.params)) {
        html += `<div><span style="color:#8aaa70">${k}:</span> ${v}</div>`;
      }
    }

    // Sub-items (beams, emitters, fish, etc.)
    for (const [key, items] of Object.entries(info)) {
      if (key === 'name' || key === 'params' || !Array.isArray(items)) continue;
      html += `<div style="margin-top:3px;color:#6a8a60">${key}:</div>`;
      // Show first 8, then summarize
      const show = items.slice(0, 8);
      for (const item of show) {
        const parts = Object.entries(item).filter(([k]) => k !== 'index').map(([k, v]) => `${k}:${v}`).join(' ');
        html += `<div style="padding-left:8px;color:#7a9a7a">[${item.index}] ${parts}</div>`;
      }
      if (items.length > 8) {
        html += `<div style="padding-left:8px;color:#5a7a5a">... +${items.length - 8} more</div>`;
      }
    }

    html += '</div>';
    return html;
  }
}
