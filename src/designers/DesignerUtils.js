/**
 * Shared UI helpers for designers.
 */

export function createSlider(label, min, max, step, value, onChange) {
  const row = document.createElement('div');
  row.className = 'control-row';

  const lbl = document.createElement('label');
  lbl.textContent = label;

  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;

  const val = document.createElement('span');
  val.className = 'value';
  val.textContent = Number(value).toFixed(step < 1 ? 2 : 0);

  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    val.textContent = v.toFixed(step < 1 ? 2 : 0);
    onChange(v);
  });

  row.append(lbl, input, val);
  return row;
}

export function createColorPicker(label, value, onChange) {
  const row = document.createElement('div');
  row.className = 'control-row';

  const lbl = document.createElement('label');
  lbl.textContent = label;

  const input = document.createElement('input');
  input.type = 'color';
  input.value = value;
  input.addEventListener('input', () => onChange(input.value));

  row.append(lbl, input);
  return row;
}

export function createSelect(label, options, value, onChange) {
  const row = document.createElement('div');
  row.className = 'control-row';

  const lbl = document.createElement('label');
  lbl.textContent = label;

  const select = document.createElement('select');
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    if (opt === value) o.selected = true;
    select.appendChild(o);
  });
  select.addEventListener('change', () => onChange(select.value));

  row.append(lbl, select);
  return row;
}

export function createSection(title) {
  const section = document.createElement('div');
  section.className = 'designer-section';
  const h3 = document.createElement('h3');
  h3.textContent = title;
  section.appendChild(h3);
  return section;
}

export function createButton(text, onClick, primary = false) {
  const btn = document.createElement('button');
  btn.className = primary ? 'btn primary' : 'btn';
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

export function createTagList(tags, activeTags, onToggle) {
  const div = document.createElement('div');
  div.className = 'tag-list';
  tags.forEach(tag => {
    const el = document.createElement('span');
    el.className = 'tag' + (activeTags.includes(tag) ? ' active' : '');
    el.textContent = tag;
    el.addEventListener('click', () => {
      el.classList.toggle('active');
      onToggle(tag, el.classList.contains('active'));
    });
    div.appendChild(el);
  });
  return div;
}
