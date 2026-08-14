/* ============================================================
   CREDITXA — Loan Application Modal Controller
   4-step KYC form → writes to Supabase clients + loan_applications
   ============================================================ */
(function () {
  'use strict';

  let currentStep = 1;
  const TOTAL_STEPS = 4;
  let prefillAmount = 10000;
  let prefillTerm   = 36;
  let prefillType   = 'personal';

  const overlay   = document.getElementById('appModalOverlay');
  if (!overlay) return; // modal not on this page — exit silently

  const form      = document.getElementById('appForm');
  const btnNext   = document.getElementById('appBtnNext');
  const btnBack   = document.getElementById('appBtnBack');
  const btnClose  = document.getElementById('appModalClose');
  const titleEl   = document.getElementById('appModalTitle');
  const summaryEl = document.getElementById('appSummary');
  const successEl = document.getElementById('appSuccessPanel');
  const footerEl  = document.getElementById('appModalFooter');

  /* ── Pill group selection ── */
  document.querySelectorAll('.app-pill-group').forEach(group => {
    const name        = group.dataset.pillName;
    const hiddenInput = group.closest('.app-field').querySelector('input[type="hidden"]');
    group.querySelectorAll('.app-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        group.querySelectorAll('.app-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
        if (hiddenInput) {
          hiddenInput.value = pill.dataset.value;
          clearError(hiddenInput.closest('.app-field'));
        }
      });
    });
  });

  /* ── Public API — called by apply buttons ── */
  window.openApplicationModal = function (opts) {
    opts = opts || {};
    prefillAmount = opts.amount  || 10000;
    prefillTerm   = opts.term    || 36;
    prefillType   = opts.loanType || 'personal';

    const labels = {
      personal:      'Crédito Pessoal',
      mortgage:      'Crédito Habitação',
      car:           'Crédito Automóvel',
      consolidation: 'Consolidação de Créditos'
    };
    titleEl.textContent = 'Pedido de ' + (labels[prefillType] || 'Crédito');

    resetModal();
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  /* ── Close ── */
  function closeModal () {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(resetModal, 350);
  }
  btnClose.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  /* ── Reset for re-use ── */
  function resetModal () {
    if (overlay.classList.contains('open')) return; // don't reset while open
    form.reset();
    document.querySelectorAll('.app-pill').forEach(p => p.classList.remove('selected'));
    document.querySelectorAll('.app-field').forEach(f => f.classList.remove('has-error'));
    document.querySelectorAll('.app-form-step').forEach(s => s.classList.remove('active'));
    successEl.style.display = 'none';
    footerEl.style.display  = 'flex';
    btnNext.disabled  = false;
    btnBack.disabled  = false;
    goToStep(1);
  }

  /* ── Step navigation ── */
  function goToStep (step) {
    currentStep = step;
    document.querySelectorAll('.app-form-step').forEach(s => s.classList.remove('active'));
    const target = document.querySelector('.app-form-step[data-step="' + step + '"]');
    if (target) target.classList.add('active');

    document.querySelectorAll('.app-modal__step-bar').forEach(bar => {
      const n = parseInt(bar.dataset.stepBar, 10);
      bar.classList.toggle('done',   n < step);
      bar.classList.toggle('active', n === step);
    });

    btnBack.style.display = step > 1 ? 'inline-flex' : 'none';
    btnNext.textContent   = step === TOTAL_STEPS ? 'Enviar Pedido →' : 'Continuar →';

    if (step === TOTAL_STEPS) buildSummary();
  }

  /* ── Summary on step 4 ── */
  function buildSummary () {
    const d = getData();
    const typeLabels = { personal:'Pessoal', mortgage:'Habitação', car:'Automóvel', consolidation:'Consolidação' };
    const rows = [
      ['Nome',           d.full_name || '—'],
      ['NIF',            d.nif       || '—'],
      ['Email',          d.email     || '—'],
      ['Telefone',       d.phone     || '—'],
      ['Rendimento/mês', d.monthly_income ? '€' + Number(d.monthly_income).toLocaleString('pt-PT') : '—'],
      ['Tipo',           typeLabels[prefillType] || prefillType],
      ['Montante',       '€' + Number(prefillAmount).toLocaleString('pt-PT')],
      ['Prazo',          prefillTerm + ' meses'],
    ];
    summaryEl.innerHTML = rows.map(([lbl, val]) =>
      `<div class="app-summary__row">
         <span class="app-summary__label">${lbl}</span>
         <span class="app-summary__value">${val}</span>
       </div>`
    ).join('');
  }

  /* ── Collect form data ── */
  function getData () {
    const out = {};
    new FormData(form).forEach((v, k) => { out[k] = v; });
    return out;
  }

  /* ── Validation ── */
  function validateStep (step) {
    const stepEl = document.querySelector('.app-form-step[data-step="' + step + '"]');
    let ok = true;

    stepEl.querySelectorAll('[required]').forEach(input => {
      const field = input.closest('.app-field');
      let valid = true;

      if (input.type === 'checkbox')      valid = input.checked;
      else if (input.type === 'hidden')   valid = input.value.trim().length > 0;
      else                                valid = input.value.trim().length > 0;

      // Extra rules
      if (valid) {
        if (input.name === 'nif')           valid = /^\d{9}$/.test(input.value.trim());
        if (input.name === 'email')         valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
        if (input.name === 'phone')         valid = input.value.replace(/\D/g,'').length >= 9;
        if (input.name === 'iban')          valid = input.value.replace(/\s/g,'').length >= 15;
        if (input.name === 'date_of_birth') {
          const age = (Date.now() - new Date(input.value)) / 31557600000;
          valid = age >= 18 && age < 100;
        }
      }

      if (field) {
        field.classList.toggle('has-error', !valid);
      }
      if (!valid) ok = false;
    });

    return ok;
  }

  function clearError (field) {
    if (field) field.classList.remove('has-error');
  }

  /* ── Button handlers ── */
  btnNext.addEventListener('click', async () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < TOTAL_STEPS) {
      goToStep(currentStep + 1);
    } else {
      await submitApplication();
    }
  });

  btnBack.addEventListener('click', () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  });

  /* ── Submit to Supabase ── */
  async function submitApplication () {
    btnNext.disabled = true;
    btnBack.disabled = true;
    btnNext.innerHTML = '<span class="app-spinner"></span> A enviar...';

    const sb = window._supabase;
    if (!sb) {
      alert('Erro de ligação. Por favor recarregue a página e tente novamente.');
      btnNext.disabled = false;
      btnBack.disabled = false;
      btnNext.textContent = 'Enviar Pedido →';
      return;
    }

    const d = getData();
    const rateMap = { personal: 0.0799, mortgage: 0.0309, car: 0.0599, consolidation: 0.0649 };
    const loanType = prefillType;

    try {
      // Everything (find-or-create client + create application) happens
      // atomically, server-side, inside a single SECURITY DEFINER RPC.
      // This avoids exposing the `clients` table to direct anon
      // read/write access — the browser never sees other applicants'
      // data, and all validation is re-checked in the database itself.
      const { data: appNo, error: rpcErr } = await sb.rpc('submit_loan_application', {
        p_full_name:          d.full_name,
        p_email:              d.email,
        p_nif:                d.nif,
        p_phone:              d.phone || null,
        p_address:            d.address || null,
        p_date_of_birth:      d.date_of_birth || null,
        p_nationality:        d.nationality || null,
        p_residence_status:   d.residence_status  || null,
        p_id_document_type:   d.id_document_type  || null,
        p_id_document_number: d.id_document_number || null,
        p_monthly_income:     d.monthly_income ? parseFloat(d.monthly_income) : null,
        p_iban:               d.iban ? d.iban.replace(/\s/g,'') : null,
        p_employment_status:  d.employment_status || null,
        p_loan_type:          loanType,
        p_amount:             parseFloat(prefillAmount),
        p_term_months:        parseInt(prefillTerm, 10),
        p_annual_rate:        rateMap[loanType] || 0.0799,
        p_loan_purpose:       d.loan_purpose || null,
        p_existing_debts:     d.existing_debts ? parseFloat(d.existing_debts) : 0,
      });
      if (rpcErr) throw new Error(rpcErr.message);

      // Show success
      document.querySelectorAll('.app-form-step').forEach(s => s.classList.remove('active'));
      successEl.style.display = 'block';
      footerEl.style.display  = 'none';
      document.getElementById('appRefCode').textContent = '#' + appNo;
      document.querySelectorAll('.app-modal__step-bar').forEach(b => {
        b.classList.add('done');
        b.classList.remove('active');
      });
      window.showToast && window.showToast('🎉 Pedido recebido! Entraremos em contacto em breve.');

    } catch (err) {
      console.error('Submission error:', err);
      btnNext.disabled  = false;
      btnBack.disabled  = false;
      btnNext.textContent = 'Enviar Pedido →';
      alert('Não foi possível enviar o seu pedido.\n\n' + err.message + '\n\nPor favor tente novamente ou contacte-nos diretamente.');
    }
  }
})();
