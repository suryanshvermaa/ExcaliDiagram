;(function () {
  var curPage = 1
  var curPages = 1
  var PAGE_SZ = 24

  // ── Search / filter ─────────────────────────────────────────────────────────
  var searchTimer = null
  document.getElementById('search').addEventListener('input', function () {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(function () { loadIcons(1) }, 280)
  })
  document.getElementById('filterCat').addEventListener('change', function () {
    loadIcons(1)
  })

  // ── Pagination (event delegation) ───────────────────────────────────────────
  document.getElementById('pagBtns').addEventListener('click', function (e) {
    var btn = e.target.closest('.pag-btn')
    if (!btn || btn.disabled) return
    var pg = parseInt(btn.getAttribute('data-pg'), 10)
    if (!isNaN(pg) && pg > 0) loadIcons(pg)
  })

  // ── Delete (event delegation) ────────────────────────────────────────────────
  document.getElementById('iconGrid').addEventListener('click', function (e) {
    var btn = e.target.closest('.del-btn')
    if (!btn) return
    var id = btn.getAttribute('data-id')
    if (!id || !confirm('Delete "' + id + '"?')) return
    fetch('/api/icons/' + id, { method: 'DELETE' })
      .then(function (r) { return r.json() })
      .then(function (d) {
        if (d.ok) { toast('Deleted ✓', 'ok'); loadIcons(curPage) }
        else toast(d.error || 'Delete failed', 'err')
      })
      .catch(function () { toast('Network error', 'err') })
  })

  // ── Load icons ───────────────────────────────────────────────────────────────
  function loadIcons(pg) {
    var q   = document.getElementById('search').value.trim()
    var cat = document.getElementById('filterCat').value || 'All'
    var url = '/api/icons?q=' + encodeURIComponent(q) +
              '&category=' + encodeURIComponent(cat) +
              '&page=' + pg + '&limit=' + PAGE_SZ

    var grid = document.getElementById('iconGrid')
    grid.innerHTML = '<p class="msg">Loading…</p>'

    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status)
        return r.json()
      })
      .then(function (data) {
        curPage  = data.page  || 1
        curPages = data.pages || 1

        document.getElementById('stats').textContent =
          (data.total || 0) + ' icons · page ' + curPage + '/' + curPages

        var start = (curPage - 1) * PAGE_SZ + 1
        var end   = Math.min(curPage * PAGE_SZ, data.total || 0)
        document.getElementById('pagInfo').textContent =
          start + '–' + end + ' of ' + (data.total || 0)

        rebuildPag(curPage, curPages)

        if (!data.icons || !data.icons.length) {
          grid.innerHTML = '<p class="msg">No icons found</p>'
          return
        }
        grid.innerHTML = data.icons.map(function (ic) {
          return '<div class="icon-tile">' +
            '<button class="del-btn" data-id="' + ic.id + '">✕</button>' +
            '<img src="/api/icons/' + ic.id + '/svg" alt="' + ic.name + '" loading="lazy" onerror="this.style.opacity=\'.2\'" />' +
            '<p title="' + ic.name + '">' + ic.name + '</p>' +
            '</div>'
        }).join('')
      })
      .catch(function (e) {
        grid.innerHTML = '<p class="msg" style="color:#fc8181">Error: ' + e.message + '</p>'
      })
  }

  // ── Rebuild pagination buttons ───────────────────────────────────────────────
  function rebuildPag(p, totalPages) {
    var c    = document.getElementById('pagBtns')
    var html = '<button class="pag-btn" data-pg="' + (p - 1) + '"' + (p <= 1 ? ' disabled' : '') + '>‹</button>'
    for (var i = 1; i <= totalPages; i++) {
      html += '<button class="pag-btn' + (i === p ? ' cur' : '') + '" data-pg="' + i + '">' + i + '</button>'
    }
    html += '<button class="pag-btn" data-pg="' + (p + 1) + '"' + (p >= totalPages ? ' disabled' : '') + '>›</button>'
    c.innerHTML = html
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  document.getElementById('tabFile').addEventListener('click', function () { switchTab('file') })
  document.getElementById('tabJson').addEventListener('click', function () { switchTab('json') })
  function switchTab(t) {
    document.getElementById('tabFile').classList.toggle('active', t === 'file')
    document.getElementById('tabJson').classList.toggle('active', t === 'json')
    document.getElementById('paneFile').classList.toggle('active', t === 'file')
    document.getElementById('paneJson').classList.toggle('active', t === 'json')
  }

  // ── Drop zone ────────────────────────────────────────────────────────────────
  var dropZone    = document.getElementById('dropZone')
  var fileInput   = document.getElementById('fileInput')
  var selectedFile = null

  dropZone.addEventListener('click', function () { fileInput.click() })
  dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.classList.add('dragover') })
  dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('dragover') })
  dropZone.addEventListener('drop', function (e) {
    e.preventDefault(); dropZone.classList.remove('dragover')
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  })
  fileInput.addEventListener('change', function () {
    if (fileInput.files[0]) handleFile(fileInput.files[0])
  })

  function handleFile(f) {
    if (!f.name.endsWith('.svg') && f.type !== 'image/svg+xml') {
      return toast('Only SVG accepted', 'err')
    }
    selectedFile = f
    document.getElementById('fileName').textContent = f.name
    document.getElementById('uploadBtn').disabled = false
    var r = new FileReader()
    r.onload = function (e) {
      document.getElementById('svgPreview').src = e.target.result
      document.getElementById('previewWrap').style.display = 'flex'
    }
    r.readAsDataURL(f)
  }

  // ── File upload ───────────────────────────────────────────────────────────────
  document.getElementById('uploadBtn').addEventListener('click', function () {
    var name = document.getElementById('iName').value.trim()
    var cat  = document.getElementById('iNewCat').value.trim() || document.getElementById('iCategory').value.trim()
    var tags = document.getElementById('iTags').value.trim()
    if (!name)         return toast('Name is required', 'err')
    if (!cat)          return toast('Category is required', 'err')
    if (!selectedFile) return toast('Select an SVG file', 'err')
    var btn = document.getElementById('uploadBtn')
    btn.disabled = true; btn.textContent = 'Uploading…'
    var fd = new FormData()
    fd.append('file', selectedFile); fd.append('name', name)
    fd.append('category', cat); fd.append('tags', tags)
    fetch('/api/icons/upload', { method: 'POST', body: fd })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d } }) })
      .then(function (res) {
        if (res.ok) { toast('✅ "' + res.d.icon.name + '" uploaded', 'ok'); loadIcons(1) }
        else toast(res.d.error || 'Upload failed', 'err')
      })
      .catch(function () { toast('Network error', 'err') })
      .finally(function () { btn.disabled = false; btn.textContent = 'Upload Icon' })
  })

  // ── JSON upload ───────────────────────────────────────────────────────────────
  document.getElementById('uploadJsonBtn').addEventListener('click', function () {
    var payload
    try { payload = JSON.parse(document.getElementById('jsonPayload').value) }
    catch (e) { return toast('Invalid JSON', 'err') }
    fetch('/api/icons/upload/svg-string', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d } }) })
      .then(function (res) {
        if (res.ok) { toast('✅ "' + res.d.icon.name + '" uploaded', 'ok'); loadIcons(1) }
        else toast(res.d.error || 'Upload failed', 'err')
      })
      .catch(function () { toast('Network error', 'err') })
  })

  // ── Toast ────────────────────────────────────────────────────────────────────
  var toastT
  function toast(msg, type) {
    var el = document.getElementById('toast')
    el.textContent = msg; el.className = 'show ' + (type || 'ok')
    clearTimeout(toastT)
    toastT = setTimeout(function () { el.className = '' }, 3000)
  }

  // ── Init: populate pagination from data attributes on page ───────────────────
  var pagBtns = document.getElementById('pagBtns')
  if (pagBtns) {
    var cur = pagBtns.querySelector('.cur')
    if (cur) curPage = parseInt(cur.getAttribute('data-pg'), 10) || 1
    var allBtns = pagBtns.querySelectorAll('.pag-btn[data-pg]')
    allBtns.forEach(function (b) {
      var n = parseInt(b.getAttribute('data-pg'), 10)
      if (!isNaN(n) && n > curPages) curPages = n
    })
  }
})()
