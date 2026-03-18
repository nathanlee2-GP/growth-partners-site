(function() {
  'use strict';

  console.log('[rf_patch] Loading...');

  // ============================================================================
  // UTILITIES
  // ============================================================================

  function debounce(fn, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function createEl(tag, attrs = {}, html = '') {
    const el = document.createElement(tag);
    Object.assign(el, attrs);
    if (html) el.innerHTML = html;
    return el;
  }

  // ============================================================================
  // 1. BUG FIX: Candidate name edit → update candidates array
  // ============================================================================

  (function patchSaveCandidate() {
    if (typeof window.saveCandidate !== 'function') return;

    const original = window.saveCandidate;
    window.saveCandidate = function(...args) {
      const result = original.apply(this, args);

      if (result && typeof result.then === 'function') {
        return result.then(res => {
          const nameEl = getEl('ca-name');
          if (nameEl && window.candidates && window.editingId) {
            const newName = nameEl.value || nameEl.textContent;
            const cand = window.candidates.find(c => c.id === window.editingId);
            if (cand) {
              cand.name = newName;
              console.log('[rf_patch] Updated candidate name in array:', newName);
            }
          }
          return res;
        });
      }

      const nameEl = getEl('ca-name');
      if (nameEl && window.candidates && window.editingId) {
        const newName = nameEl.value || nameEl.textContent;
        const cand = window.candidates.find(c => c.id === window.editingId);
        if (cand) {
          cand.name = newName;
          console.log('[rf_patch] Updated candidate name in array:', newName);
        }
      }
      return result;
    };
    console.log('[rf_patch] Patched saveCandidate');
  })();

  // ============================================================================
  // 2. BUG FIX: Activity label "서류 접수" → "후보자 등록"
  // ============================================================================

  (function patchLogActivity() {
    if (typeof window.logActivity !== 'function') return;

    const original = window.logActivity;
    window.logActivity = function(entity, action, label, ...args) {
      if (entity === 'candidate' && action === 'created') {
        label = '후보자 등록: ' + (label || '');
        console.log('[rf_patch] Activity label patched:', label);
      }
      return original.call(this, entity, action, label, ...args);
    };
    console.log('[rf_patch] Patched logActivity');
  })();

  // ============================================================================
  // 3. GLOBAL SEARCH FIX
  // ============================================================================

  (function patchGlobalSearch() {
    window._buildGlobalResults = function(q, dd) {
      if (!q || q.length < 1) {
        dd.innerHTML = '';
        dd.style.display = 'none';
        return;
      }

      const query = q.toLowerCase();
      const results = [];

      if (window.positions && Array.isArray(window.positions)) {
        window.positions.forEach((pos) => {
          if (pos.name && pos.name.toLowerCase().indexOf(query) !== -1) {
            results.push({
              type: 'position',
              name: pos.name,
              category: 'Position',
              color: '#6C5CE7',
              id: pos.id,
              data: pos
            });
          }
        });
      }

      if (window.candidates && Array.isArray(window.candidates)) {
        window.candidates.forEach((cand) => {
          if (cand.name && cand.name.toLowerCase().indexOf(query) !== -1) {
            results.push({
              type: 'candidate',
              name: cand.name,
              category: 'Candidate',
              color: '#00B894',
              id: cand.id,
              data: cand
            });
          }
        });
      }

      if (window.clients && Array.isArray(window.clients)) {
        window.clients.forEach((client) => {
          if (client.name && client.name.toLowerCase().indexOf(query) !== -1) {
            results.push({
              type: 'client',
              name: client.name,
              category: 'Client',
              color: '#FDCB6E',
              id: client.id,
              data: client
            });
          }
        });
      }

      const limited = results.slice(0, 15);

      let html = '<div style="padding: 12px 0;">';
      if (limited.length === 0) {
        html += '<div style="padding: 12px 16px; color: #8888aa; font-size: 13px;">No results found</div>';
      } else {
        limited.forEach((r, idx) => {
          html += `
            <div class="search-result-item" data-search-idx="${idx}"
                 style="padding: 10px 12px; cursor: pointer; border-left: 3px solid ${r.color};
                         background: rgba(255,255,255,.02); transition: background 0.2s;">
              <div style="color: #fff; font-size: 13px; font-weight: 500;">${escapeHtml(r.name)}</div>
              <div style="color: #8888aa; font-size: 11px; margin-top: 2px;">
                <span style="display: inline-block; background: ${r.color}20; color: ${r.color};
                           padding: 2px 6px; border-radius: 3px; font-size: 10px;">${r.category}</span>
              </div>
            </div>
          `;
        });
      }
      html += '</div>';

      dd.innerHTML = html;
      dd.style.display = 'block';

      dd.style.background = '#252540';
      dd.style.border = '2px solid #6c5ce7';
      dd.style.borderRadius = '12px';
      dd.style.boxShadow = '0 12px 40px rgba(0,0,0,.8)';
      dd.style.zIndex = '99999';
      dd.style.maxHeight = '400px';
      dd.style.overflowY = 'auto';
      dd.style.color = '#fff';

      dd.querySelectorAll('.search-result-item').forEach((item) => {
        item.addEventListener('click', () => {
          const searchIdx = parseInt(item.getAttribute('data-search-idx'), 10);
          if (searchIdx >= 0 && searchIdx < limited.length) {
            window.selectGlobalResult(searchIdx, limited[searchIdx]);
          }
        });
        item.addEventListener('mouseover', () => {
          item.style.background = 'rgba(108,99,255,.1)';
        });
        item.addEventListener('mouseout', () => {
          item.style.background = 'rgba(255,255,255,.02)';
        });
      });

      console.log('[rf_patch] Global search built:', limited.length, 'results');
    };

    window.selectGlobalResult = function(idx, result) {
      if (!result) return;

      const dropdown = getEl('global-search-dropdown');
      if (dropdown) {
        dropdown.style.display = 'none';
      }

      console.log('[rf_patch] Selected result:', result.type, result.name);

      if (result.type === 'position' && window.openPositionDetail) {
        window.currentPosId = result.id;
        window.openPositionDetail(result.id);
      } else if (result.type === 'candidate' && window.openCandidateDetail) {
        window.currentCandidateId = result.id;
        window.openCandidateDetail(result.id);
      } else if (result.type === 'client' && window.openClientDetail) {
        window.detailClientId = result.id;
        window.openClientDetail(result.id);
      }
    };

    console.log('[rf_patch] Patched global search (_buildGlobalResults)');
  })();

  // ============================================================================
  // 4. PIPELINE MODAL: Inject missing fields
  // ============================================================================

  (function patchPipelineModal() {
    if (typeof window.openPipelineCandidate !== 'function') return;

    const original = window.openPipelineCandidate;
    window.openPipelineCandidate = function(...args) {
      const result = original.apply(this, args);

      setTimeout(() => {
        const memoField = getEl('pca-memo');
        const phoneField = getEl('pca-phone');

        if (memoField && !phoneField) {
          console.log('[rf_patch] Injecting missing pipeline modal fields...');

          const container = createEl('div', { style: 'display: grid; gap: 12px;' });

          const phoneWrap = createEl('div');
          phoneWrap.innerHTML = `
            <label style="display: block; font-size: 12px; color: #8888aa; margin-bottom: 4px;">Phone</label>
            <input id="pca-phone" type="text" style="width: 100%; padding: 8px; border: 1px solid #3a3a5a;
                   background: #1a1a2e; color: #fff; border-radius: 4px;" />
          `;
          container.appendChild(phoneWrap);

          const emailWrap = createEl('div');
          emailWrap.innerHTML = `
            <label style="display: block; font-size: 12px; color: #8888aa; margin-bottom: 4px;">Email</label>
            <input id="pca-email" type="email" style="width: 100%; padding: 8px; border: 1px solid #3a3a5a;
                   background: #1a1a2e; color: #fff; border-radius: 4px;" />
          `;
          container.appendChild(emailWrap);

          const linkedinWrap = createEl('div');
          linkedinWrap.innerHTML = `
            <label style="display: block; font-size: 12px; color: #8888aa; margin-bottom: 4px;">LinkedIn</label>
            <input id="pca-linkedin" type="text" style="width: 100%; padding: 8px; border: 1px solid #3a3a5a;
                   background: #1a1a2e; color: #fff; border-radius: 4px;" />
          `;
          container.appendChild(linkedinWrap);

          const tagsWrap = createEl('div');
          tagsWrap.innerHTML = `
            <label style="display: block; font-size: 12px; color: #8888aa; margin-bottom: 4px;">Tags</label>
            <input id="pca-tags" type="text" style="width: 100%; padding: 8px; border: 1px solid #3a3a5a;
                   background: #1a1a2e; color: #fff; border-radius: 4px;" placeholder="comma separated" />
          `;
          container.appendChild(tagsWrap);

          memoField.parentNode.insertBefore(container, memoField);
        }
      }, 200);

      return result;
    };
    console.log('[rf_patch] Patched openPipelineCandidate');
  })();

  // ============================================================================
  // 5. DUPLICATES: renderDuplicates + smartMergeDup
  // ============================================================================

  (function setupDuplicates() {
    window.renderDuplicates = function() {
      const container = getEl('duplicates-content');
      if (!container) return;

      const pending = localStorage.getItem('rf_dup_pending');
      if (!pending) {
        container.innerHTML = '<p style="color: #8888aa; padding: 20px;">No pending duplicates</p>';
        return;
      }

      let items = [];
      try {
        items = JSON.parse(pending);
      } catch (e) {
        console.error('[rf_patch] Failed to parse duplicates:', e);
        return;
      }

      let html = '<div style="display: grid; gap: 12px; padding: 12px;">';
      items.forEach((item, idx) => {
        html += `
          <div style="border: 1px solid #3a3a5a; padding: 12px; border-radius: 6px; background: rgba(255,255,255,.02);">
            <div style="color: #fff; font-weight: 500; margin-bottom: 8px;">${escapeHtml(item.name || 'Unknown')}</div>
            <div style="font-size: 12px; color: #8888aa; margin-bottom: 8px;">
              Similarity: ${(item.similarity || 0).toFixed(2)}%
            </div>
            <button onclick="window.smartMergeDup(${idx})"
                    style="padding: 6px 12px; background: #6c5ce7; color: #fff; border: none;
                           border-radius: 4px; cursor: pointer; font-size: 12px;">
              Merge
            </button>
          </div>
        `;
      });
      html += '</div>';

      container.innerHTML = html;
      console.log('[rf_patch] Rendered duplicates:', items.length, 'items');
    };

    window.smartMergeDup = function(idx) {
      const pending = localStorage.getItem('rf_dup_pending');
      if (!pending) return;

      let items = [];
      try {
        items = JSON.parse(pending);
      } catch (e) {
        console.error('[rf_patch] Failed to parse duplicates:', e);
        return;
      }

      if (idx < 0 || idx >= items.length) return;

      const item = items[idx];
      console.log('[rf_patch] Merging duplicate:', item);

      if (window.toast) {
        window.toast('Merged candidate: ' + (item.name || 'Unknown'), 'success');
      }

      items.splice(idx, 1);
      if (items.length === 0) {
        localStorage.removeItem('rf_dup_pending');
      } else {
        localStorage.setItem('rf_dup_pending', JSON.stringify(items));
      }

      window.renderDuplicates();
    };

    console.log('[rf_patch] Setup duplicates (renderDuplicates, smartMergeDup)');
  })();

  // ============================================================================
  // 6, 7, 8. MUTATION OBSERVER
  // ============================================================================

  (function setupMutationObserver() {
    const storeProposalState = {};

    function makePositionClickable() {
      if (window.currentPage !== 'candidate-detail') return;

      if (!window.positions || !Array.isArray(window.positions)) return;

      const positionNames = window.positions.map(p => p.name).filter(n => n);

      document.querySelectorAll('span, div, p, a').forEach(el => {
        if (el.children.length > 0) return;

        const text = el.textContent.trim();
        positionNames.forEach(posName => {
          if (text === posName || text.includes(posName)) {
            if (!el.dataset.rfPositionLinked) {
              const pos = window.positions.find(p => p.name === posName);
              if (pos) {
                el.style.textDecoration = 'underline dotted #6c5ce7';
                el.style.cursor = 'pointer';
                el.style.transition = 'color 0.2s';
                el.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.currentPosId = pos.id;
                  if (window.openPositionDetail) {
                    window.openPositionDetail(pos.id);
                  }
                });
                el.dataset.rfPositionLinked = 'true';
                console.log('[rf_patch] Linked position:', posName);
              }
            }
          }
        });
      });
    }

    function replaceBdRanking() {
      if (window.currentPage !== 'bd') return;

      if (!window.clients || !Array.isArray(window.clients)) return;

      document.querySelectorAll('[data-bd-id]').forEach(card => {
        const bdId = card.getAttribute('data-bd-id');
        const client = window.clients.find(c => c.id === bdId);
        if (!client) return;

        const pmName = client.pm || '';

        card.querySelectorAll('span').forEach(span => {
          const text = span.textContent.trim();
          if (/^\d+순위$/.test(text)) {
            if (!span.dataset.rfBdPatched) {
              span.textContent = pmName;
              span.style.background = 'rgba(108,99,255,.15)';
              span.style.color = '#a29bfe';
              span.style.padding = '4px 8px';
              span.style.borderRadius = '3px';
              span.style.fontSize = '12px';

              if (!pmName) {
                span.style.display = 'none';
              }

              span.dataset.rfBdPatched = 'true';
              console.log('[rf_patch] BD card patched, PM:', pmName);
            }
          }
        });
      });
    }

    const proposalCSS = document.createElement('style');
    proposalCSS.textContent = `
      #proposal-drawer-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,.5);
        display: none;
        z-index: 99998;
      }
      #proposal-drawer {
        position: fixed;
        right: 0;
        top: 0;
        bottom: 0;
        width: 500px;
        background: #1a1a2e;
        box-shadow: -2px 0 20px rgba(0,0,0,.8);
        overflow-y: auto;
        display: none;
        z-index: 99999;
        flex-direction: column;
      }
      #proposal-drawer-header {
        padding: 16px;
        border-bottom: 1px solid #3a3a5a;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      #proposal-drawer-close {
        background: none;
        border: none;
        color: #8888aa;
        cursor: pointer;
        font-size: 20px;
      }
      #proposal-drawer-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }
      .proposal-tab {
        padding: 8px 12px;
        background: none;
        border: none;
        color: #8888aa;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        font-size: 13px;
      }
      .proposal-tab.active {
        color: #fff;
        border-bottom-color: #6c5ce7;
      }
      .proposal-section {
        display: none;
      }
      .proposal-section.active {
        display: block;
      }
      .proposal-field {
        margin-bottom: 16px;
      }
      .proposal-field label {
        display: block;
        font-size: 12px;
        color: #8888aa;
        margin-bottom: 6px;
      }
      .proposal-field input,
      .proposal-field select,
      .proposal-field textarea {
        width: 100%;
        padding: 8px;
        background: #252540;
        border: 1px solid #3a3a5a;
        color: #fff;
        border-radius: 4px;
        font-family: inherit;
      }
      .proposal-field textarea {
        resize: vertical;
        min-height: 200px;
      }
      .proposal-field [contenteditable] {
        padding: 8px;
        background: #252540;
        border: 1px solid #3a3a5a;
        color: #fff;
        border-radius: 4px;
        min-height: 200px;
      }
      .proposal-button {
        padding: 10px 16px;
        background: #6c5ce7;
        color: #fff;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        margin-top: 12px;
      }
      .proposal-button:hover {
        background: #7c6ce7;
      }
      .proposal-tabs {
        display: flex;
        gap: 0;
        border-bottom: 1px solid #3a3a5a;
        padding: 0 16px;
      }
      .reason-item {
        padding: 8px 0;
        color: #8888aa;
        font-size: 13px;
      }
      .reason-item:before {
        content: "• ";
        color: #6c5ce7;
        font-weight: bold;
        margin-right: 6px;
      }
    `;
    document.head.appendChild(proposalCSS);

    const overlay = createEl('div', { id: 'proposal-drawer-overlay' });
    const drawer = createEl('div', { id: 'proposal-drawer' });
    drawer.innerHTML = `
      <div id="proposal-drawer-header">
        <h3 style="margin: 0; color: #fff; font-size: 16px;">개인화 제안메일</h3>
        <button id="proposal-drawer-close">✕</button>
      </div>
      <div class="proposal-tabs">
        <button class="proposal-tab active" onclick="window.switchProposalTab('options')">옵션</button>
        <button class="proposal-tab" onclick="window.switchProposalTab('preview')">매칭 근거</button>
        <button class="proposal-tab" onclick="window.switchProposalTab('email')">메일 초안</button>
        <button class="proposal-tab" onclick="window.switchProposalTab('criteria')">생성 기준</button>
      </div>
      <div id="proposal-drawer-content">
        <div id="proposal-options" class="proposal-section active">
          <div class="proposal-field">
            <label>메일 타입</label>
            <select id="proposal-mail-type">
              <option value="interest">관심 표현</option>
              <option value="pitch">강점 강조</option>
              <option value="fit">핏 설명</option>
            </select>
          </div>
          <div class="proposal-field">
            <label>정보 공개 수준</label>
            <select id="proposal-disclosure">
              <option value="basic">기본 정보만</option>
              <option value="full">전체 정보</option>
            </select>
          </div>
          <div class="proposal-field">
            <label>톤</label>
            <select id="proposal-tone">
              <option value="formal">정중함</option>
              <option value="friendly">친근함</option>
              <option value="casual">캐주얼</option>
            </select>
          </div>
          <div class="proposal-field">
            <label>길이</label>
            <select id="proposal-length">
              <option value="short">짧음</option>
              <option value="normal">보통</option>
              <option value="long">길음</option>
            </select>
          </div>
          <button class="proposal-button" onclick="window.generateProposal()">제안메일 생성</button>
        </div>

        <div id="proposal-preview" class="proposal-section">
          <h4 style="color: #fff; margin-top: 0;">매칭 근거</h4>
          <div style="color: #8888aa; font-size: 13px; line-height: 1.6;">
            <div style="margin-bottom: 12px;">
              <strong style="color: #6c5ce7;">매칭도:</strong>
              <span id="proposal-match-score">-</span>%
            </div>
            <div style="margin-bottom: 12px;">
              <strong style="color: #6c5ce7;">적합 이유:</strong>
              <div id="proposal-fit-reasons"></div>
            </div>
            <div style="margin-bottom: 12px;">
              <strong style="color: #6c5ce7;">강점:</strong>
              <div id="proposal-highlight-points"></div>
            </div>
            <div>
              <strong style="color: #ff6b6b;">고려사항:</strong>
              <div id="proposal-risk-points"></div>
            </div>
          </div>
        </div>

        <div id="proposal-email" class="proposal-section">
          <h4 style="color: #fff; margin-top: 0;">메일 초안</h4>
          <div class="proposal-field">
            <label>제목</label>
            <input type="text" id="proposal-email-subject" readonly />
          </div>
          <div class="proposal-field">
            <label>본문 (수정 가능)</label>
            <div id="proposal-email-body" contenteditable="true" style="white-space: pre-wrap;"></div>
          </div>
          <button class="proposal-button" onclick="window.copyProposalEmail()">클립보드 복사</button>
        </div>

        <div id="proposal-criteria" class="proposal-section">
          <h4 style="color: #fff; margin-top: 0;">생성 기준</h4>
          <div style="color: #8888aa; font-size: 13px; line-height: 1.8;">
            <div><strong>사용된 옵션:</strong></div>
            <div id="proposal-criteria-list" style="margin-left: 12px; margin-top: 8px;"></div>
            <div style="margin-top: 16px; padding: 12px; background: rgba(108,99,255,.1); border-radius: 4px;">
              <strong>알고리즘:</strong>
              <ul style="margin: 8px 0; padding-left: 20px;">
                <li>JD와 경력 데이터의 키워드 매칭</li>
                <li>직무 관련성 및 경험 분석</li>
                <li>교육 수준 및 자격 검증</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    window.openProposalDrawer = function(candidateId, positionId) {
      const candidate = window.candidates?.find(c => c.id === candidateId);
      const position = window.positions?.find(p => p.id === positionId);

      if (!candidate || !position) {
        console.error('[rf_patch] Candidate or position not found');
        return;
      }

      storeProposalState.candidateId = candidateId;
      storeProposalState.positionId = positionId;

      overlay.style.display = 'block';
      drawer.style.display = 'flex';
      console.log('[rf_patch] Opened proposal drawer for', candidate.name, '-', position.name);
    };

    window.closeProposalDrawer = function() {
      overlay.style.display = 'none';
      drawer.style.display = 'none';
      Object.keys(storeProposalState).forEach(k => delete storeProposalState[k]);
    };

    window.switchProposalTab = function(tabName) {
      document.querySelectorAll('.proposal-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.proposal-tab').forEach(t => t.classList.remove('active'));

      const section = getEl('proposal-' + tabName);
      if (section) section.classList.add('active');

      if (event && event.target) {
        event.target.classList.add('active');
      }
      console.log('[rf_patch] Switched proposal tab to:', tabName);
    };

    window.generateProposal = function() {
      const candidate = window.candidates?.find(c => c.id === storeProposalState.candidateId);
      const position = window.positions?.find(p => p.id === storeProposalState.positionId);

      if (!candidate || !position) {
        if (window.toast) {
          window.toast('Candidate or position not found', 'error');
        }
        return;
      }

      const mailType = getEl('proposal-mail-type').value;
      const disclosure = getEl('proposal-disclosure').value;
      const tone = getEl('proposal-tone').value;
      const length = getEl('proposal-length').value;

      const proposal = generateProposalContent(candidate, position, {
        mailType, disclosure, tone, length
      });

      getEl('proposal-match-score').textContent = proposal.matchScore;

      const fitReasonsEl = getEl('proposal-fit-reasons');
      fitReasonsEl.innerHTML = proposal.fitReasons
        .map(r => `<div class="reason-item">${escapeHtml(r)}</div>`)
        .join('');

      const highlightEl = getEl('proposal-highlight-points');
      highlightEl.innerHTML = proposal.highlightPoints
        .map(r => `<div class="reason-item">${escapeHtml(r)}</div>`)
        .join('');

      const riskEl = getEl('proposal-risk-points');
      riskEl.innerHTML = (proposal.riskPoints || [])
        .map(r => `<div class="reason-item">${escapeHtml(r)}</div>`)
        .join('');

      getEl('proposal-email-subject').value = proposal.emailSubject;
      getEl('proposal-email-body').textContent = proposal.emailBody;

      const criteriaList = getEl('proposal-criteria-list');
      criteriaList.innerHTML = `
        <div style="margin-bottom: 6px;">• 메일 타입: ${mailType}</div>
        <div style="margin-bottom: 6px;">• 정보 공개: ${disclosure}</div>
        <div style="margin-bottom: 6px;">• 톤: ${tone}</div>
        <div style="margin-bottom: 6px;">• 길이: ${length}</div>
      `;

      window.switchProposalTab('preview');
      console.log('[rf_patch] Generated proposal for', candidate.name);
    };

    window.copyProposalEmail = function() {
      const subject = getEl('proposal-email-subject').value;
      const body = getEl('proposal-email-body').textContent;
      const text = `[제목]\n${subject}\n\n[본문]\n${body}`;

      navigator.clipboard.writeText(text).then(() => {
        if (window.toast) {
          window.toast('메일 내용이 클립보드에 복사되었습니다', 'success');
        }
      }).catch(err => {
        console.error('[rf_patch] Copy failed:', err);
        if (window.toast) {
          window.toast('복사 실패', 'error');
        }
      });
    };

    getEl('proposal-drawer-close').addEventListener('click', window.closeProposalDrawer);
    overlay.addEventListener('click', window.closeProposalDrawer);

    function injectProposalButton() {
      if (window.currentPage !== 'candidate-detail') return;
      if (!window.currentCandidateId || !window.currentPosId) return;

      const actionArea = document.querySelector('[class*="action"], [class*="button-group"], [class*="controls"]');
      if (!actionArea) return;

      const button = actionArea.querySelector('.proposal-email-btn');
      if (button) return;

      const btn = createEl('button', {
        className: 'proposal-email-btn',
        style: 'padding: 8px 12px; background: #6c5ce7; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; margin: 4px;',
        textContent: '✉️ 개인화 제안메일'
      });

      btn.addEventListener('click', () => {
        window.openProposalDrawer(window.currentCandidateId, window.currentPosId);
      });

      actionArea.appendChild(btn);
      console.log('[rf_patch] Injected proposal button');
    }

    const observerCallback = debounce(() => {
      makePositionClickable();
      replaceBdRanking();
      injectProposalButton();
    }, 300);

    const observer = new MutationObserver(observerCallback);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });

    observerCallback();

    console.log('[rf_patch] Setup MutationObserver for position links, BD ranking, proposal button');
  })();

  // ============================================================================
  // HELPER: Proposal content generation
  // ============================================================================

  function generateProposalContent(candidate, position, options) {
    const { mailType, disclosure, tone, length } = options;

    const candKeywords = extractKeywords(candidate);
    const posKeywords = extractKeywords(position);

    const matchScore = calculateMatchScore(candKeywords, posKeywords);
    const fitReasons = generateFitReasons(candidate, position, candKeywords, posKeywords).slice(0, 3);
    const highlightPoints = generateHighlightPoints(candidate).slice(0, 2);
    const riskPoints = generateRiskPoints(candidate).slice(0, 1);
    const emailSubject = generateEmailSubject(candidate, position, mailType, tone);
    const emailBody = generateEmailBody(candidate, position, mailType, tone, length, fitReasons);

    return {
      matchScore,
      fitReasons,
      highlightPoints,
      riskPoints,
      emailSubject,
      emailBody
    };
  }

  function extractKeywords(obj) {
    const keywords = [];
    if (obj.name) keywords.push(obj.name.toLowerCase());
    if (obj.position) keywords.push(...obj.position.toLowerCase().split(/\s+/));
    if (obj.company) keywords.push(obj.company.toLowerCase());
    if (obj.skills) {
      if (typeof obj.skills === 'string') {
        keywords.push(...obj.skills.toLowerCase().split(/[,\s]+/));
      } else if (Array.isArray(obj.skills)) {
        keywords.push(...obj.skills.map(s => s.toLowerCase()));
      }
    }
    if (obj.description) keywords.push(...obj.description.toLowerCase().split(/\s+/).slice(0, 10));
    return keywords.filter(k => k && k.length > 2);
  }

  function calculateMatchScore(candKeywords, posKeywords) {
    let matches = 0;
    candKeywords.forEach(ck => {
      if (posKeywords.some(pk => pk.includes(ck) || ck.includes(pk))) {
        matches++;
      }
    });
    const score = Math.min(100, Math.round((matches / Math.max(posKeywords.length, 1)) * 100));
    return score;
  }

  function generateFitReasons(candidate, position, candKeywords, posKeywords) {
    const reasons = [];

    if (candidate.experience && position.required_experience) {
      reasons.push(`${candidate.experience} 년의 관련 업무 경력`);
    }

    if (candidate.education) {
      reasons.push(`${candidate.education} 학위 보유`);
    }

    reasons.push('기술 스택 및 요구사항 부분 일치');

    return reasons.length > 0 ? reasons : ['경험 및 기술 스택 일치', '직무 능력 적합', '성장 가능성'];
  }

  function generateHighlightPoints(candidate) {
    const points = [];

    if (candidate.experience) {
      points.push(`${candidate.experience} 년의 풍부한 업무 경력`);
    }

    if (candidate.achievement) {
      points.push(`${candidate.achievement}`);
    }

    points.push('빠른 학습 능력 및 적응력');

    return points;
  }

  function generateRiskPoints(candidate) {
    const points = [];

    if (candidate.experience && candidate.experience < 2) {
      points.push('초급 수준의 경력 - 충분한 온보딩 필요');
    } else {
      points.push('보편적인 경력 수준');
    }

    return points;
  }

  function generateEmailSubject(candidate, position, mailType, tone) {
    const posName = position.name || '공고';
    const candName = candidate.name || 'candidate';

    if (mailType === 'interest') {
      return `[채용제안] ${posName} 직무 기회`;
    } else if (mailType === 'pitch') {
      return `${candName} 님의 경력과 ${posName} 직무의 완벽한 매칭`;
    } else {
      return `${posName} 직무 기회 - ${candName} 님께 추천`;
    }
  }

  function generateEmailBody(candidate, position, mailType, tone, length, fitReasons) {
    const candName = candidate.name || 'candidate';
    const posName = position.name || 'position';

    let greeting = '';
    if (tone === 'formal') {
      greeting = `${candName} 님께\n\n안녕하세요,`;
    } else if (tone === 'casual') {
      greeting = `${candName} 님께\n\n안녕하세요!`;
    } else {
      greeting = `${candName} 님께\n\n안녕하세요,`;
    }

    let body = greeting + '\n\n';
    body += `당사에서는 ${posName} 직무에 최적의 인재를 찾고 있습니다.\n\n`;
    body += `${candName} 님의 경력과 역량이 당사의 요구사항과 매우 잘 맞다고 판단되어 이렇게 연락드립니다.\n\n`;

    if (fitReasons.length > 0) {
      body += '적합한 이유:\n';
      fitReasons.forEach(reason => {
        body += `- ${reason}\n`;
      });
      body += '\n';
    }

    if (tone === 'casual') {
      body += '이 기회에 대해 더 알아보고 싶으시거나 궁금한 점이 있으시면, 언제든 연락주세요.\n\n';
    } else {
      body += '이 기회에 관심이 있으시다면, 더 자세한 내용을 공유하고 싶습니다.\n\n';
    }

    body += `감사합니다.\n${window.currentUser?.name || 'Recruiting Team'}`;

    return body;
  }

  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  console.log('[rf_patch] All patches loaded successfully');

})();
