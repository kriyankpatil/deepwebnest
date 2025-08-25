(function oneTimeCleanup(){
  try {
    const MIGRATION_FLAG = 'cleanup_trim_custom_v1';
    if (!localStorage.getItem(MIGRATION_FLAG)) {
      function trimCustom(key, max){
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return;
        if (arr.length > max) {
          localStorage.setItem(key, JSON.stringify(arr.slice(0, max)));
        }
      }
      trimCustom('custom-games', 9);
      trimCustom('custom-movies', 9);
      localStorage.setItem(MIGRATION_FLAG, '1');
    }
  } catch {}
})();

// Additional one-time cleanup: remove test entries labeled 'game'/'movie'
(function cleanupRemoveTests(){
  try {
    const FLAG = 'cleanup_remove_tests_v2';
    if (localStorage.getItem(FLAG)) return;
    function removeByLabel(key, labels){
      const raw = localStorage.getItem(key);
      if (!raw) return;
      let arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      const labelSet = new Set(labels.map(s => String(s).toLowerCase()));
      arr = arr.filter(it => {
        const lbl = (it && it.label ? String(it.label) : '').trim().toLowerCase();
        return !labelSet.has(lbl);
      });
      localStorage.setItem(key, JSON.stringify(arr));
    }
    removeByLabel('custom-games', ['game']);
    removeByLabel('custom-movies', ['movie']);
    localStorage.setItem(FLAG, '1');
  } catch {}
})();

function renderList(targetId, items) {
  const container = document.getElementById(targetId);
  if (!container) return;
  const list = document.createElement('div');
  list.className = 'list list-surface';
  items.forEach((item, idx) => {
    const row = document.createElement('a');
    row.className = 'list-item';
    row.href = item.url || '#';
    row.target = '_blank';
    row.rel = 'noopener noreferrer';
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(idx + 1);
    const label = document.createElement('span');
    label.textContent = item.label;
    row.appendChild(num);
    row.appendChild(label);
    list.appendChild(row);
  });
  container.appendChild(list);
}

async function loadAndRender(jsonPath, targetId, limit) {
  try {
    const res = await fetch(jsonPath);
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    renderList(targetId, typeof limit === 'number' ? items.slice(0, limit) : items);
  } catch (e) {
    console.error('Failed to load', jsonPath, e);
  }
  return true;
}

function getCustomItems(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomItem(key, item) {
  const list = getCustomItems(key);
  list.push({ id: Date.now(), ...item });
  localStorage.setItem(key, JSON.stringify(list));
}

function deleteCustomItem(key, id) {
  const currentUser = localStorage.getItem('currentUser');
  const list = getCustomItems(key).filter(i => {
    if (i.id === id && i.owner && currentUser && i.owner !== currentUser) {
      alert('You can only delete your own links.');
      return true; // keep item
    }
    return i.id !== id;
  });
  localStorage.setItem(key, JSON.stringify(list));
  return list;
}

function renderCustomList(targetId, items, storageKey) {
  const container = document.getElementById(targetId);
  if (!container) return;
  if (!items.length) return;
  // try to use existing list box if present
  let list = container.querySelector('.list');
  if (!list) {
    list = document.createElement('div');
    list.className = 'list list-surface';
    container.appendChild(list);
  }
  const startIndex = list.querySelectorAll('.list-item').length;
  items.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'list-item list-item-custom';

    const link = document.createElement('a');
    link.href = item.url || '#';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'flex';
    link.style.alignItems = 'center';
    link.style.gap = '12px';

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(startIndex + idx + 1);
    const label = document.createElement('span');
    label.textContent = item.label;

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.type = 'button';
    del.textContent = 'Delete';
    const currentUser = localStorage.getItem('currentUser');
    if (!item.owner || !currentUser || item.owner !== currentUser) {
      del.style.display = 'none';
    }

    const edit = document.createElement('button');
    edit.className = 'edit-btn';
    edit.type = 'button';
    edit.textContent = 'Edit';
    if (!item.owner || !currentUser || item.owner !== currentUser) {
      edit.style.display = 'none';
    }
    del.addEventListener('click', async function (e) {
      e.preventDefault();
      e.stopPropagation();
      const apiBase = (window.API_BASE || '');
      const token = localStorage.getItem('authToken');
      // If this row came from backend (has numeric id) and we have a token, call API
      if (apiBase && token && item && item.id) {
        try {
          const resp = await fetch(apiBase + '/api/links/' + encodeURIComponent(item.id), {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
          });
          const data = await resp.json().catch(()=>({}));
          if (!resp.ok || !data.ok) throw new Error((data && data.error) || 'delete failed');
          // Remove row from UI without re-rendering everything
          if (row && row.parentElement) {
            row.parentElement.removeChild(row);
          }
          return;
        } catch (err) {
          alert('Delete failed: ' + (err && err.message ? err.message : 'unknown error'));
          return;
        }
      }
      // Fallback: localStorage-managed custom items
      const updated = deleteCustomItem(storageKey, item.id);
      renderCustomList(targetId, updated, storageKey);
    });

    edit.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const newLabel = prompt('Edit title', item.label) || '';
      const newUrl = prompt('Edit URL', item.url) || '';
      if (!newLabel.trim() || !newUrl.trim()) return;
      const list = getCustomItems(storageKey).map(i => i.id === item.id ? { ...i, label: newLabel.trim(), url: newUrl.trim() } : i);
      localStorage.setItem(storageKey, JSON.stringify(list));
      renderCustomList(targetId, list, storageKey);
    });

    link.appendChild(num);
    link.appendChild(label);
    row.appendChild(link);
    row.appendChild(edit);
    row.appendChild(del);
    list.appendChild(row);
  });
  // appended to existing list
}

function attachAddLink(formId, inputLabelId, inputUrlId, targetId, storageKey) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    let label = document.getElementById(inputLabelId).value.trim();
    let url = document.getElementById(inputUrlId).value.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    if (!label || !url) return;
    saveCustomItem(storageKey, { label, url });
    const existing = getCustomItems(storageKey);
    renderCustomList(targetId, existing, storageKey);
    form.reset();
  });

  // render any saved items on load
  const existing = getCustomItems(storageKey);
  if (existing.length) {
    renderCustomList(targetId, existing, storageKey);
  }
}


