// video/web/static/components/object-renderer.js

class ObjectRenderer extends HTMLElement {
  set data(obj){ this._render(obj); }
  _render(obj){
    const container = document.createElement('div');
    container.classList.add('kvp');
    Object.entries(obj).forEach(([k,v])=>{
      const row = document.createElement('div');
      row.classList.add('row');
      row.innerHTML = `<span class="key">${k}</span>: <span class="val"></span>`;
      const valCell = row.querySelector('.val');
      if      (Array.isArray(v))        valCell.append(this._renderArray(v));
      else if (v && typeof v==='object') valCell.append(this._render(v));
      else                                valCell.textContent = String(v);
      container.append(row);
    });
    this.replaceChildren(container);
  }
  _renderArray(arr){
    const ul = document.createElement('ul');
    arr.forEach(item=>{
      const li = document.createElement('li');
      if (item && typeof item==='object') li.append(this._render(item));
      else li.textContent = String(item);
      ul.append(li);
    });
    return ul;
  }
}
customElements.define('object-renderer', ObjectRenderer);