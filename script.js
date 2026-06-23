/* ═══════════════════════════════════════════
   TENNISPRO ACADEMY — SCRIPT.JS (FIXED & FULL FIREBASE)
   ═══════════════════════════════════════════ */

/* ════════════════════════════════
   STATE & ARRAYS GLOBAL
════════════════════════════════ */
let booking = {
  date: null,
  time: null,
  coach: null,
  court: null,
  payment: null,
};

// Mengambil session login browser agar user tidak perlu login ulang terus
window.isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
let myBookings = []; 

const SESSION_PRICE = 150000;     // Harga tetap per sesi booking (Rp 150.000)
const CANCEL_REFUND_PERCENT = 30; // Persentase dana yang dikembalikan saat booking dibatalkan
let pendingCancelBooking = null;  // Menyimpan data booking yang sedang dikonfirmasi untuk dibatalkan

function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

let calYear  = 2026;
let calMonth = 4; // Mei (0-indexed)

const monthNames = [
  'JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI',
  'JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'
];
const dayLabels = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

/* ════════════════════════════════
   SMOOTH SCROLL
════════════════════════════════ */
function scrollToSection(id) {
  const section = document.getElementById(id);
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* ════════════════════════════════
   DYNAMIC NAVBAR (DENGAN BADGE MEMBERSHIP)
════════════════════════════════ */
function updateNavigationUI(name, membership = "Bronze") {
  const navAuth = document.getElementById("navAuth");
  if (!navAuth) return;

  if (window.isLoggedIn && name) {
    let badgeColor = "#cd7f32"; 
    if (membership === "Silver") badgeColor = "#778899"; 
    if (membership === "Elite") badgeColor = "#c9a84c"; 

    navAuth.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; font-family: 'Barlow', sans-serif;">
        <span style="color: #ffffff; font-weight: 600;">👤 ${name}</span>
        <span style="background: ${badgeColor}; color: white; font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; font-weight: bold; text-transform: uppercase;">
          ${membership}
        </span>
        <button class="btn-logout" onclick="handleLogout()" style="padding: 0.4rem 1rem;">Keluar</button>
      </div>
    `;
  } else {
    navAuth.innerHTML = `
      <button class="btn-ghost" onclick="openModal('login')">Masuk</button>
      <button class="btn-red"   onclick="openModal('register')">Daftar</button>
    `;
  }
}

/* ════════════════════════════════
   SISTEM AUTENTIKASI (FIREBASE)
════════════════════════════════ */
async function handleRegister() {
  const regForm = document.getElementById('formRegister');
  const name = regForm.querySelector('input[type="text"]').value.trim();
  const email = regForm.querySelector('input[type="email"]').value.trim().toLowerCase();
  const password = regForm.querySelector('input[type="password"]').value;

  if (!name || !email || !password) {
    alert("⚠️ Semua data pendaftaran wajib diisi!");
    return;
  }
  if (password.length < 6) {
    alert("⚠️ Password minimal harus 6 karakter!");
    return;
  }

  try {
    const q = window.query(window.collection(window.db, "users"), window.where("email", "==", email));
    const querySnapshot = await window.getDocs(q);

    if (!querySnapshot.empty) {
      alert("❌ Email sudah terdaftar! Silakan langsung masuk.");
      return;
    }

    await window.addDoc(window.collection(window.db, "users"), {
      nama: name,
      email: email,
      password: password,
      role: "student",
      registeredAt: new Date().toISOString()
    });

    showToast('✅ Akun Berhasil Dibuat!', 'Silakan login menggunakan email tersebut.');
    
    // Kosongkan form
    regForm.querySelector('input[type="text"]').value = "";
    regForm.querySelector('input[type="email"]').value = "";
    regForm.querySelector('input[type="password"]').value = "";
    
    switchTab('login');
  } catch (error) {
    console.error("Gagal mendaftar:", error);
    alert("❌ Terjadi kesalahan sistem saat mendaftar.");
  }
}

async function handleLogin() {
  const loginForm = document.getElementById('formLogin');
  const email = loginForm.querySelector('input[type="email"]').value.trim().toLowerCase();
  const password = loginForm.querySelector('input[type="password"]').value;

  if (!email || !password) {
    alert("⚠️ Email dan Password wajib diisi!");
    return;
  }

  try {
    const q = window.query(window.collection(window.db, "users"), window.where("email", "==", email));
    const querySnapshot = await window.getDocs(q);

    if (querySnapshot.empty) {
      alert("❌ Akun tidak ditemukan! Periksa kembali email Anda.");
      return;
    }

    let userData = null;
    querySnapshot.forEach((doc) => { userData = doc.data(); });

    if (userData.password === password) {
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userEmail", userData.email);
      localStorage.setItem("userName", userData.nama);
      localStorage.setItem("userMembership", userData.membership || "Bronze");

      window.isLoggedIn = true;
      updateNavigationUI(userData.nama, userData.membership || "Bronze");
      
      closeModal();
      showToast('🎾 Selamat Datang Kembali!', `Halo ${userData.nama}, siap untuk latihan?`);
      
      // Ambil riwayat bookingnya
      fetchMyBookingsFromCloud();
    } else {
      alert("❌ Password salah! Silakan coba lagi.");
    }
  } catch (error) {
    console.error("Gagal login:", error);
    alert("❌ Terjadi masalah koneksi sistem saat mencoba login.");
  }
}

function handleLogout() {
  localStorage.clear();
  window.isLoggedIn = false;
  
  booking = { date: null, time: null, coach: null, court: null, payment: null };
  updateSummary();
  myBookings = [];
  renderMyBookings();
  updateNavigationUI();
  
  document.querySelectorAll('.cal-day.selected, .time-slot.selected, .court-opt.selected, .pay-btn.selected')
          .forEach(e => e.classList.remove('selected'));

  showToast('🔒 Sesi Berakhir', 'Kamu telah keluar akun.');
  setTimeout(() => { openModal('login'); }, 1000);
}

/* ════════════════════════════════
   FIREBASE: PENGAMBILAN DATA
════════════════════════════════ */
function getStatusClass(status) {
  if (status === 'Dibatalkan') return 'status-cancelled';
  if (status === 'Dikonfirmasi' || status === 'Aktif') return 'status-confirmed';
  return 'status-pending';
}

function renderMyBookings() {
  const container = document.getElementById('schedulesContainer');
  if (!container) return;

  if (myBookings.length === 0) {
    container.innerHTML = `
      <div class="no-booking-card">
        <p>Belum ada jadwal latihan aktif. Silakan lakukan pengisian formulir booking di atas.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = myBookings.map(b => {
    const isMembership = b._type === 'membership';
    const statusClass = getStatusClass(b.status);
    const canCancel = !isMembership && b.status === 'Dikonfirmasi';
    const isCancelled = b.status === 'Dibatalkan';
    const price = b.price || SESSION_PRICE;

    return `
    <div class="schedule-card">
      <div class="schedule-header">
        <span class="schedule-id">${b.id || 'TP-MEMBERSHIP'}</span>
        <span class="schedule-status ${statusClass}">${b.status}</span>
      </div>
      <div class="schedule-body">
        ${isMembership ? `
          <div class="schedule-item"><span class="schedule-label">Paket</span><span class="schedule-value highlight">${b.paket}</span></div>
        ` : `
          <div class="schedule-item"><span class="schedule-label">Tanggal</span><span class="schedule-value">${b.date}</span></div>
          <div class="schedule-item"><span class="schedule-label">Waktu</span><span class="schedule-value highlight">${b.time} WIB</span></div>
          <div class="schedule-item"><span class="schedule-label">Coach</span><span class="schedule-value">${b.coach}</span></div>
          <div class="schedule-item"><span class="schedule-label">Lapangan</span><span class="schedule-value">${b.court}</span></div>
          <div class="schedule-item"><span class="schedule-label">Total Bayar</span><span class="schedule-value">${formatRupiah(price)}</span></div>
        `}
      </div>
      ${canCancel ? `
        <div class="schedule-actions">
          <button type="button" class="btn-cancel-booking"
            data-doc-id="${b._docId}" data-price="${price}"
            data-date="${b.date}" data-time="${b.time}"
            data-coach="${b.coach}" data-court="${b.court}">
            Batalkan Booking
          </button>
        </div>
      ` : ''}
      ${isCancelled ? `
        <div class="refund-note">Dana sebesar <strong>${formatRupiah(b.refundAmount || 0)}</strong> (${b.refundPercentage || CANCEL_REFUND_PERCENT}%) sedang diproses pengembaliannya.</div>
      ` : ''}
      ${isMembership ? `
        <div class="no-cancel-note">🔒 Paket membership tidak dapat dibatalkan.</div>
      ` : ''}
    </div>
  `;
  }).join('');

  container.querySelectorAll('.btn-cancel-booking').forEach(btn => {
    btn.addEventListener('click', () => {
      openCancelModal({
        docId: btn.dataset.docId,
        price: Number(btn.dataset.price),
        date: btn.dataset.date,
        time: btn.dataset.time,
        coach: btn.dataset.coach,
        court: btn.dataset.court
      });
    });
  });
}

/* State terpisah untuk merge dua koleksi secara aman */
let _bookingDocs    = [];
let _membershipDocs = [];

function mergeAndRender() {
  myBookings = [..._bookingDocs, ..._membershipDocs].sort((a, b) => {
    const tA = a.timestamp || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const tB = b.timestamp || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return tB - tA;
  });
  renderMyBookings();
}

function fetchMyBookingsFromCloud() {
  if (!window.db || !window.isLoggedIn) return;
  const userEmail = localStorage.getItem("userEmail");

  /* Listener booking — FLAT, tidak di-nest */
  window.onSnapshot(
    window.query(window.collection(window.db, "bookings"), window.where("userEmail", "==", userEmail)),
    (snap) => {
      _bookingDocs = snap.docs.map(doc => ({ ...doc.data(), _docId: doc.id, _type: 'booking' }));
      mergeAndRender();
    }
  );

  /* Listener membership — FLAT, terpisah, tidak bergantung snapshot booking */
  window.onSnapshot(
    window.query(window.collection(window.db, "membership_payments"), window.where("email", "==", userEmail)),
    (snap) => {
      _membershipDocs = snap.docs.map(doc => ({ ...doc.data(), _docId: doc.id, _type: 'membership' }));
      mergeAndRender();
    }
  );
}

/* ════════════════════════════════
   CALENDAR WORKFLOW
════════════════════════════════ */
function renderCalendar() {
  const grid = document.getElementById('calGrid');
  if (!grid) return;
  document.getElementById('calMonth').textContent = monthNames[calMonth] + ' ' + calYear;
  grid.innerHTML = '';

  dayLabels.forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-day-label';
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
  const totalDays      = new Date(calYear, calMonth + 1, 0).getDate();
  const today          = new Date();

  for (let i = 0; i < firstDayOfWeek; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }

  for (let d = 1; d <= totalDays; d++) {
    const el   = document.createElement('div');
    const date = new Date(calYear, calMonth, d);
    const dow  = date.getDay();

    const isWeekend = dow === 0 || dow === 6;
    const isPast    = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isToday   = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();

    el.textContent = d;
    el.className   = 'cal-day ' +
      (isWeekend ? (isPast ? 'weekend past' : 'weekend') : 'weekday') +
      (isToday ? ' today' : '');

    if (isWeekend && !isPast) {
      el.onclick = () => {
        if (!window.isLoggedIn) {
          showToast('🔒 Akses Ditolak', 'Harap login terlebih dahulu sebelum memilih jadwal.');
          openModal('login');
          return;
        }
        selectDate(el, calYear, calMonth, d, dow);
      };
    }
    grid.appendChild(el);
  }
}

function prevMonth() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); }
function nextMonth() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); }

/* ════════════════════════════════
   FORM SELECTORS & SUMMARY
════════════════════════════════ */
const SUNDAY_DISABLED_SLOTS = ['07:00', '13:00', '18:00'];
let selectedDow = null;

function selectDate(el, y, m, d, dow) {
  document.querySelectorAll('.cal-day.selected').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  selectedDow   = dow;
  const dayName = dow === 6 ? 'Sabtu' : 'Minggu';
  booking.date  = `${dayName}, ${d} ${monthNames[m]} ${y}`;

  // Reset pilihan waktu kalau slot yang dipilih tidak berlaku di hari baru
  if (dow === 0 && booking.time && SUNDAY_DISABLED_SLOTS.includes(booking.time)) {
    booking.time = null;
    document.querySelectorAll('.time-slot.selected').forEach(e => e.classList.remove('selected'));
  }

  updateTimeSlotAvailability(dow);
  updateSummary();
  loadAvailabilitySensor(booking.date);
}

// Disable/enable slot waktu berdasarkan hari terpilih
function updateTimeSlotAvailability(dow) {
  const isSunday = dow === 0;
  document.querySelectorAll('.time-slot').forEach(el => {
    const onclickAttr = el.getAttribute('onclick') || '';
    const match       = onclickAttr.match(/'(\d{2}:\d{2})'/);
    const time        = match ? match[1] : null;
    if (!time) return;

    const blocked = isSunday && SUNDAY_DISABLED_SLOTS.includes(time);
    el.classList.toggle('disabled-day', blocked);
    if (blocked) el.classList.remove('selected');
  });
}

function selectTime(el, time) {
  if (!window.isLoggedIn) { openModal('login'); return; }
  // Blokir slot yang tidak boleh di hari Minggu
  if (selectedDow === 0 && SUNDAY_DISABLED_SLOTS.includes(time)) return;
  if (el.classList.contains('disabled-day') || el.classList.contains('full')) return;

  document.querySelectorAll('.time-slot.selected').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  booking.time = time;
  updateSummary();
  highlightSensorSelection();
}

function selectCoach(el, name) {
  if (!window.isLoggedIn) { openModal('login'); return; }
  el.closest('.court-select').querySelectorAll('.court-opt.selected').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  booking.coach = name;
  updateSummary();
}

function selectCourt(el, name) {
  if (!window.isLoggedIn) { openModal('login'); return; }
  el.closest('.court-select').querySelectorAll('.court-opt.selected').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  booking.court = name;
  updateSummary();
  highlightSensorSelection();
}

function selectPay(el, name) {
  if (!window.isLoggedIn) { openModal('login'); return; }
  document.querySelectorAll('.pay-btn.selected').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  booking.payment = name;
  updateSummary();
}

function updateSummary() {
  document.getElementById('sumDate').textContent  = booking.date    || '—';
  document.getElementById('sumTime').textContent  = booking.time    ? booking.time + ' WIB' : '—';
  document.getElementById('sumCoach').textContent = booking.coach   || '—';
  document.getElementById('sumCourt').textContent = booking.court   || '—';
  document.getElementById('sumPay').textContent   = booking.payment || '—';
}

async function confirmBooking() {
  if (!window.isLoggedIn) { openModal('login'); return; }
  if (!booking.date || !booking.time || !booking.coach || !booking.court || !booking.payment) {
    alert("⚠️ Data belum lengkap! Pilih tanggal, waktu, coach, lapangan, dan metode pembayaran.");
    return;
  }

  // ── Validasi kapasitas: max 10 orang per lapangan+waktu, dan max 10 per coach+waktu ──
  showToast('⏳ Memeriksa...', 'Mengecek ketersediaan slot...');
  try {
    const allSnap = await window.getDocs(
      window.query(
        window.collection(window.db, 'bookings'),
        window.where('date',   '==', booking.date),
        window.where('status', '==', 'Dikonfirmasi')
      )
    );
    const sameDayActive = allSnap.docs.map(d => d.data());

    const courtCount = sameDayActive.filter(b => b.court === booking.court && b.time === booking.time).length;
    if (courtCount >= 10) {
      showToast('❌ Lapangan Penuh', `${booking.court} jam ${booking.time} sudah penuh (maks. 10 orang). Pilih lapangan atau jam lain.`);
      return;
    }

    const coachCount = sameDayActive.filter(b => b.coach === booking.coach && b.time === booking.time).length;
    if (coachCount >= 10) {
      showToast('❌ Coach Penuh', `${booking.coach} jam ${booking.time} sudah penuh (maks. 10 peserta). Pilih coach atau jam lain.`);
      return;
    }
  } catch (err) {
    console.error('Capacity check error:', err);
    // Jika pengecekan gagal, tetap lanjutkan agar user tidak terblokir karena error jaringan sesaat
  }

  openPaymentModal(null, null);
}

/* ════════════════════════════════
   MODAL CONTROLS & TOAST NOTIFICATION
════════════════════════════════ */
function openModal(tab) {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.classList.add('open');
    if (tab) switchTab(tab);
  }
}

function closeModal() {
  if (!window.isLoggedIn) {
    showToast('⚠️ Wajib Login', 'Anda harus masuk akun terlebih dahulu.');
    return; 
  }
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('open');
}

function switchTab(tab) {
  document.getElementById('formLogin').style.display    = tab === 'login'    ? 'flex' : 'none';
  document.getElementById('formRegister').style.display = tab === 'register' ? 'flex' : 'none';
  document.getElementById('tabLogin').classList.toggle('active',    tab === 'login');
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('modalTitle').textContent = tab === 'login' ? 'Masuk' : 'Buat Akun';
}

function showToast(title, sub) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastSub').textContent   = sub;
  toast.classList.add('show');
  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => toast.classList.remove('show'), 4000);
}

/* ════════════════════════════════
   PAYMENT WORKFLOW (MEMBERSHIP & BOOKING)
════════════════════════════════ */
function openPaymentModal(tier, price) {
  const paymentModal = document.getElementById('paymentModal');
  if (!paymentModal) return;

  const payTitle = paymentModal.querySelector('.pay-title');
  const paySubtitle = paymentModal.querySelector('.pay-subtitle');
  const payMethodName = document.getElementById('payMethodName');

  if (tier && price) {
    if (payTitle) payTitle.innerHTML = `Pembayaran Membership <span style="color:var(--red-bright)">${tier}</span>`;
    if (paySubtitle) paySubtitle.innerHTML = `Transfer sebesar <strong>${price}</strong> untuk mengaktifkan paket.`;
    if (payMethodName) payMethodName.textContent = 'Transfer Bank / QRIS';
    
    localStorage.setItem("activePaymentType", "membership");
    localStorage.setItem("selectedMembershipTier", tier);
  } else {
    if (payTitle) payTitle.innerText = "Pembayaran Booking Lapangan";
    if (paySubtitle) paySubtitle.innerText = "Selesaikan pembayaran sesuai sesi yang kamu pilih.";
    if (payMethodName) payMethodName.textContent = booking.payment || 'QRIS';
    
    localStorage.setItem("activePaymentType", "booking");
  }

  paymentModal.classList.add('open');
}

window.openMembershipPayment = function(tier, price) {
  if (!window.isLoggedIn) {
    openModal('login');
    return;
  }
  openPaymentModal(tier, price);
};

function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) modal.classList.remove('open');
}

async function finishPayment() {
  const paymentType = localStorage.getItem("activePaymentType");

  showToast('⏳ Memproses', 'Sedang mengirim data ke server...');

  try {
    const userEmail = localStorage.getItem("userEmail");
    const userName = localStorage.getItem("userName");

    if (paymentType === "membership") {
      const tier = localStorage.getItem("selectedMembershipTier");
      await window.addDoc(window.collection(window.db, "membership_payments"), {
        nama: userName,
        email: userEmail,
        paket: tier,
        status: "Aktif",
        createdAt: new Date().toISOString()
      });
      alert(`🎉 Sukses! Paket membership ${tier} kamu sudah aktif sekarang.`);
      localStorage.removeItem("activePaymentType");
      localStorage.removeItem("selectedMembershipTier");
    } else {
      const bookingId = 'TP-' + Math.floor(1000 + Math.random() * 9000);
      await window.addDoc(window.collection(window.db, "bookings"), {
        id: bookingId,
        userEmail: userEmail,
        userName: userName,
        date: booking.date,
        time: booking.time,
        coach: booking.coach,
        court: booking.court,
        payment: booking.payment,
        price: SESSION_PRICE,
        status: 'Dikonfirmasi',
        timestamp: new Date().getTime()
      });
      
      showToast('✅ Booking Dikonfirmasi', 'Slot latihan kamu sudah otomatis terkonfirmasi!');
      
      // Reset State
      booking = { date: null, time: null, coach: null, court: null, payment: null };
      updateSummary();
      document.querySelectorAll('.cal-day.selected, .time-slot.selected, .court-opt.selected, .pay-btn.selected')
              .forEach(e => e.classList.remove('selected'));
      
      setTimeout(() => { scrollToSection('my-schedules'); }, 600);
    }

    closePaymentModal();

  } catch (error) {
    console.error("Kesalahan jaringan: ", error);
    alert('❌ Terjadi kesalahan saat mengirim data. Pastikan koneksi internet stabil.');
  }
}

/* ════════════════════════════════
   COACH DETAIL POP-UP (FITUR BARU)
════════════════════════════════ */
const coachDatabase = {
  "coach-daniel": {
    name: "Coach Daniel",
    spec: "Power Serve · Tournament Strategy",
    avatar: "CD",
    bio: "Mantan atlet sirkuit nasional senior dengan spesialisasi pukulan bertenaga tinggi (heavy spin & flat serve). Sangat cocok untuk pemain tingkat lanjut (advanced) yang ingin mempersiapkan diri menghadapi turnamen resmi.",
    experience: [
      "Pelatih Kepala Tim Daerah (2019 - 2023)",
      "Sertifikasi ITF Level 2 (Advanced Coach)",
      "Mantan Top 10 Peringkat Nasional Pemain Tunggal Putra"
    ],
    style: "Disiplin tinggi, fokus analisis mekanika tubuh, serta simulasi tekanan taktik pertandingan nyata."
  },
  "coach-sarah": {
    name: "Coach Sarah",
    spec: "Beginner Friendly · Footwork Agility",
    avatar: "CS",
    bio: "Berpengalaman membina fondasi dasar tenis yang baik untuk pemula dewasa maupun anak-anak. Fokus utama sarah adalah mengemas latihan footwork yang intens namun tetap menyenangkan dan minim risiko cedera.",
    experience: [
      "Sertifikasi Coaching Junior dari USPTR (USA)",
      "Sarjana Ilmu Keolahragaan / Sports Science",
      "Spesialisasi Program Cardio Tennis & Fitness Agility"
    ],
    style: "Sangat komunikatif, suportif, penuh energi, dan mengutamakan pengulangan bentuk ayunan (stroke form) yang presisi."
  },
  "coach-michael": {
    name: "Coach Michael",
    spec: "Slice/Top Spin Backhand · Court Tactics",
    avatar: "CM",
    bio: "Dengan rekam jejak melatih lebih dari 12 tahun, Coach Michael adalah pakar strategi penempatan posisi lapangan (positioning) baik untuk sektor tunggal maupun ganda. Ia terkenal mampu memperbaiki akurasi backhand dalam waktu singkat.",
    experience: [
      "12+ Tahun Pengalaman Melatih Klub Profesional & Internasional",
      "Sertifikasi International Tennis Federation (ITF) Level 1 & 2",
      "Spesialis Analisis Video Swing Pemain (Video Biomechanics Analysis)"
    ],
    style: "Analitis, taktis, santai namun detail, menggunakan pendekatan visual dan target box di lapangan."
  }
};

window.openCoachModal = function(coachId) {
  const modal = document.getElementById('coachDetailModal');
  const data = coachDatabase[coachId];

  if (!modal || !data) return;

  // Render text data
  document.getElementById('modalCoachName').innerText = data.name;
  document.getElementById('modalCoachSpec').innerText = data.spec;
  document.getElementById('modalCoachAvatar').innerText = data.avatar;
  document.getElementById('modalCoachBio').innerText = data.bio;
  document.getElementById('modalCoachStyle').innerText = data.style;

  // Render list pengalaman
  const expList = document.getElementById('modalCoachExp');
  expList.innerHTML = "";
  data.experience.forEach(exp => {
    const li = document.createElement('li');
    li.innerHTML = `<span style="color: var(--red-bright); font-size: 0.7rem;">&#9670;</span> ${exp}`;
    expList.appendChild(li);
  });

  // Tombol aksi: Tutup modal -> Scroll ke form -> Pilih Coach
  const ctaBtn = document.getElementById('modalCoachCTA');
  ctaBtn.onclick = function() {
    closeCoachModal();
    scrollToSection('booking');
    
    // Otomatis menekan pilihan coach di dalam form
    setTimeout(() => {
      const coachOptions = document.querySelectorAll('.court-select .court-opt');
      coachOptions.forEach(opt => {
        if (opt.innerText.includes(data.name)) {
          opt.click(); 
        }
      });
    }, 600); // Tunggu animasi scroll selesai
  };

  modal.classList.add('open');
};

window.closeCoachModal = function() {
  const modal = document.getElementById('coachDetailModal');
  if (modal) modal.classList.remove('open');
};

/* ════════════════════════════════
   PEMBATALAN BOOKING & REFUND 30%
   (Khusus booking lapangan — membership tidak bisa dibatalkan)
════════════════════════════════ */
function openCancelModal(data) {
  const modal = document.getElementById('cancelModal');
  const detailBox = document.getElementById('cancelBookingDetail');
  const refundEl = document.getElementById('cancelRefundAmount');

  if (!modal || !detailBox || !refundEl) {
    console.error('Elemen modal pembatalan tidak ditemukan di HTML (cancelModal/cancelBookingDetail/cancelRefundAmount). Pastikan index.html sudah versi terbaru.');
    alert('⚠️ Terjadi kesalahan teknis: modal konfirmasi tidak ditemukan. Coba refresh halaman (Ctrl+Shift+R) atau pastikan file index.html sudah versi terbaru.');
    return;
  }

  pendingCancelBooking = data;
  const refundAmount = Math.round(data.price * (CANCEL_REFUND_PERCENT / 100));

  detailBox.innerHTML = `
    <div class="schedule-item"><span class="schedule-label">Tanggal</span><span class="schedule-value">${data.date}</span></div>
    <div class="schedule-item"><span class="schedule-label">Waktu</span><span class="schedule-value">${data.time} WIB</span></div>
    <div class="schedule-item"><span class="schedule-label">Coach</span><span class="schedule-value">${data.coach}</span></div>
    <div class="schedule-item"><span class="schedule-label">Lapangan</span><span class="schedule-value">${data.court}</span></div>
    <div class="schedule-item"><span class="schedule-label">Total Dibayar</span><span class="schedule-value">${formatRupiah(data.price)}</span></div>
  `;

  refundEl.textContent = formatRupiah(refundAmount);
  modal.classList.add('open');
}

function closeCancelModal() {
  pendingCancelBooking = null;
  const modal = document.getElementById('cancelModal');
  if (modal) modal.classList.remove('open');
}

async function confirmCancelBooking() {
  if (!pendingCancelBooking) return;
  const { docId, price } = pendingCancelBooking;
  const refundAmount = Math.round(price * (CANCEL_REFUND_PERCENT / 100));

  const confirmBtn = document.getElementById('confirmCancelBtn');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Memproses...'; }

  try {
    const bookingRef = window.doc(window.db, "bookings", docId);
    await window.updateDoc(bookingRef, {
      status: 'Dibatalkan',
      cancelledAt: new Date().toISOString(),
      refundPercentage: CANCEL_REFUND_PERCENT,
      refundAmount: refundAmount,
      refundStatus: 'Diproses'
    });

    closeCancelModal();
    showToast('✅ Booking Dibatalkan', `Dana sebesar ${formatRupiah(refundAmount)} (${CANCEL_REFUND_PERCENT}%) sedang diproses pengembaliannya.`);
  } catch (error) {
    console.error("Gagal membatalkan booking:", error);
    alert('❌ Gagal membatalkan booking. Coba lagi nanti.');
  } finally {
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Ya, Batalkan'; }
  }
}

/* ════════════════════════════════
   CHATBOT — TENNISPRO ASSISTANT
════════════════════════════════ */
let chatbotHasGreeted = false;

// Basis pengetahuan sederhana berbasis kata kunci (FAQ rule-based)
const chatbotRules = [
  {
    keywords: ['booking', 'cara booking', 'pesan', 'reservasi', 'cara daftar sesi', 'cara pesan'],
    response: "Gampang kok! Klik menu Booking di navbar, lalu pilih tanggal (khusus Sabtu/Minggu), jam latihan, coach favorit, lapangan, dan metode pembayaran. Setelah transfer, klik tombol \"Saya Sudah Bayar\" dan slot kamu otomatis ke-booking 🎾"
  },
  {
    keywords: ['jadwal', 'weekend', 'buka jam berapa', 'jam operasional', 'hari apa', 'kapan buka'],
    response: "TennisPro cuma buka di akhir pekan! Sabtu jam 07:00, 10:00 & 18:00, lalu Minggu jam 08:00, 13:00 & 19:00. Konsep weekend-only ini bikin coach lebih fokus dan latihan kamu lebih maksimal."
  },
  {
    keywords: ['coach', 'pelatih', 'siapa saja', 'instruktur'],
    response: "Ada 3 coach profesional di sini: Coach Daniel (power serve & strategi turnamen), Coach Sarah (ramah untuk pemula & footwork), dan Coach Michael (taktik lapangan & backhand). Klik foto mereka di section Coaches buat lihat profil lengkapnya!"
  },
  {
    keywords: ['harga', 'biaya', 'membership', 'paket', 'tarif', 'berapa harga'],
    response: "Info harga sesi & paket membership (Bronze/Silver/Elite) lengkap ada di section Membership ya, tinggal scroll ke bagian itu untuk lihat semua benefitnya."
  },
  {
    keywords: ['bayar', 'pembayaran', 'qris', 'transfer', 'dana', 'ovo', 'gopay', 'e-wallet'],
    response: "Pembayaran bisa lewat QRIS, transfer Bank BCA, atau e-wallet (DANA/OVO/GoPay). Setelah transfer, klik tombol \"Saya Sudah Bayar\" dan booking kamu langsung otomatis terkonfirmasi, tanpa perlu nunggu verifikasi admin lagi."
  },
  {
    keywords: ['lokasi', 'alamat', 'dimana', 'bogor', 'tempat'],
    response: "TennisPro Academy berlokasi di Bogor dengan 4 lapangan premium (indoor & outdoor, hard court & clay). Alamat lengkap dikirim otomatis setelah booking kamu dikonfirmasi."
  },
  {
    keywords: ['login', 'masuk', 'daftar akun', 'akun', 'password', 'sign up', 'register'],
    response: "Klik tombol Masuk di pojok kanan atas navbar buat login, atau pindah ke tab Daftar kalau belum punya akun. Login wajib dulu sebelum booking supaya jadwal kamu tersimpan rapi di menu Jadwal Saya."
  },
  {
    keywords: ['refund', 'batal', 'cancel', 'pembatalan'],
    response: "Booking lapangan bisa kamu batalkan sendiri kok lewat menu Jadwal Saya, klik tombol \"Batalkan Booking\" di kartu booking-nya. Dana akan dikembalikan otomatis sebesar 30% dari total pembayaran. Catatan: khusus paket membership tidak bisa dibatalkan ya."
  },
  {
    keywords: ['terima kasih', 'makasih', 'thanks', 'thx'],
    response: "Sama-sama! Semoga latihannya seru 🎾 Ada lagi yang bisa dibantu?"
  },
  {
    keywords: ['halo', 'hai', 'hi', 'pagi', 'siang', 'malam', 'permisi'],
    response: "Hai juga! Aku siap bantu soal booking, jadwal weekend, coach, harga, atau pembayaran. Mau tanya yang mana dulu?"
  }
];

const chatbotQuickReplies = [
  "Cara booking gimana?",
  "Jadwal weekend jam berapa?",
  "Ada coach apa aja?",
  "Metode pembayaran apa saja?"
];

function toggleChatbot(forceOpen) {
  const widget = document.getElementById('chatbotWidget');
  if (!widget) return;

  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !widget.classList.contains('open');
  widget.classList.toggle('open', shouldOpen);

  if (shouldOpen) {
    if (!chatbotHasGreeted) {
      chatbotHasGreeted = true;
      addChatMessage('bot', 'Halo! Aku TennisPro Assistant 🎾 Ada yang bisa aku bantu soal booking, jadwal, coach, atau pembayaran?');
      renderQuickReplies(chatbotQuickReplies);
    }
    const input = document.getElementById('chatbotInput');
    if (input) setTimeout(() => input.focus(), 300);
  }
}

function handleChatbotKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendChatMessage();
  }
}

function sendQuickReply(text) {
  const input = document.getElementById('chatbotInput');
  if (input) input.value = text;
  sendChatMessage();
}

function sendChatMessage() {
  const input = document.getElementById('chatbotInput');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  addChatMessage('user', text);
  input.value = '';
  renderQuickReplies([]); // sembunyikan quick reply lama setelah user mulai mengetik

  showChatTyping();
  const thinkDelay = 500 + Math.random() * 500;
  setTimeout(() => {
    hideChatTyping();
    const reply = getChatbotResponse(text);
    addChatMessage('bot', reply);
  }, thinkDelay);
}

function getChatbotResponse(userText) {
  const normalized = userText.toLowerCase();
  for (const rule of chatbotRules) {
    if (rule.keywords.some(kw => normalized.includes(kw))) {
      return rule.response;
    }
  }
  return "Hmm, aku belum nangkep maksudnya 🤔 Coba tanya soal booking, jadwal weekend, coach, harga membership, atau pembayaran ya. Kalau butuh bantuan lebih detail, hubungi admin lewat menu Hubungi Kami di footer.";
}

function addChatMessage(sender, text) {
  const container = document.getElementById('chatbotMessages');
  if (!container) return;

  const msg = document.createElement('div');
  msg.className = 'chat-msg ' + sender;

  const avatar = document.createElement('div');
  avatar.className = 'chat-msg-avatar';
  avatar.textContent = sender === 'bot' ? '🎾' : '🙂';

  const bubble = document.createElement('div');
  bubble.className = 'chat-msg-bubble';
  bubble.textContent = text; // textContent agar input user tidak dirender sebagai HTML

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  container.appendChild(msg);

  container.scrollTop = container.scrollHeight;
}

function showChatTyping() {
  const container = document.getElementById('chatbotMessages');
  if (!container || document.getElementById('chatTypingRow')) return;

  const row = document.createElement('div');
  row.className = 'chat-msg bot chat-typing-row';
  row.id = 'chatTypingRow';
  row.innerHTML = `
    <div class="chat-msg-avatar">🎾</div>
    <div class="chat-typing"><span></span><span></span><span></span></div>
  `;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function hideChatTyping() {
  const row = document.getElementById('chatTypingRow');
  if (row) row.remove();
}

function renderQuickReplies(list) {
  const container = document.getElementById('chatbotQuickReplies');
  if (!container) return;
  container.innerHTML = '';
  list.forEach(text => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'quick-reply-chip';
    chip.textContent = text;
    chip.addEventListener('click', () => sendQuickReply(text));
    container.appendChild(chip);
  });
}

/* ════════════════════════════════
   SENSOR KETERSEDIAAN LAPANGAN (REAL-TIME)
════════════════════════════════ */
const SENSOR_VENUES = [
  'Arena Tenis Bogor',
  'Gor Padjajaran',
  'Lapangan Tennis Yasmin',
  'Tennis Taman Cimanggu'
];
const SENSOR_VENUE_SHORT = {
  'Arena Tenis Bogor':      'Arena Bogor',
  'Gor Padjajaran':         'Gor Padj.',
  'Lapangan Tennis Yasmin': 'Yasmin',
  'Tennis Taman Cimanggu':  'Cimanggu'
};
const SENSOR_TIMESLOTS = ['07:00','09:00','11:00','13:00','15:00','17:00','18:00','20:00'];

let sensorUnsubscribe = null; // simpan fungsi unsubscribe listener lama

function loadAvailabilitySensor(selectedDate) {
  const stateEl  = document.getElementById('sensorState');
  const gridEl   = document.getElementById('sensorGrid');
  const subEl    = document.getElementById('sensorSubtitle');

  if (!stateEl || !gridEl) return;

  // Cabut listener lama sebelum pasang yang baru
  if (sensorUnsubscribe) { sensorUnsubscribe(); sensorUnsubscribe = null; }

  // Tampilkan loading
  stateEl.style.display = 'flex';
  stateEl.innerHTML = `
    <div class="sensor-loading">
      <div class="sensor-spinner"></div>
      <div class="sensor-loading-text">Memuat data real-time untuk <strong>${selectedDate}</strong>…</div>
    </div>
  `;
  gridEl.style.display = 'none';
  if (subEl) subEl.textContent = `Menampilkan ketersediaan untuk ${selectedDate}`;

  // Pasang real-time listener ke Firestore
  try {
    const q = window.query(
      window.collection(window.db, 'bookings'),
      window.where('date', '==', selectedDate)
    );

    sensorUnsubscribe = window.onSnapshot(q, (snapshot) => {
      const bookings = snapshot.docs.map(d => d.data());
      renderSensorGrid(selectedDate, bookings);
    }, (err) => {
      console.error('Sensor listener error:', err);
      stateEl.style.display = 'flex';
      stateEl.innerHTML = `
        <div class="sensor-idle-icon">⚠️</div>
        <div class="sensor-idle-text">Gagal memuat data. Periksa koneksi internet kamu.</div>
      `;
      gridEl.style.display = 'none';
    });
  } catch (err) {
    console.error('Sensor query error:', err);
  }
}

function renderSensorGrid(selectedDate, bookings) {
  const stateEl  = document.getElementById('sensorState');
  const gridEl   = document.getElementById('sensorGrid');
  const tableEl  = document.getElementById('sensorTable');
  const summaryEl = document.getElementById('sensorSummary');

  if (!tableEl) return;

  // Buat map: "venue|time" → status booking
  const bookedMap    = {};
  const cancelledMap = {};
  bookings.forEach(b => {
    const key = `${b.court}|${b.time}`;
    if (b.status === 'Dibatalkan') cancelledMap[key] = true;
    else bookedMap[key] = true;
  });

  let totalSlots     = SENSOR_VENUES.length * SENSOR_TIMESLOTS.length;
  let totalBooked    = 0;
  let totalCancelled = 0;

  // Header baris
  let html = '<thead><tr>';
  html += '<th class="venue-col">Lapangan</th>';
  SENSOR_TIMESLOTS.forEach(t => { html += `<th>${t}</th>`; });
  html += '</tr></thead><tbody>';

  // Baris per venue
  SENSOR_VENUES.forEach(venue => {
    html += '<tr>';
    html += `<td class="sensor-venue-label">${SENSOR_VENUE_SHORT[venue] || venue}</td>`;

    SENSOR_TIMESLOTS.forEach(t => {
      const key       = `${venue}|${t}`;
      const isBooked  = bookedMap[key];
      const isCancelled = cancelledMap[key] && !isBooked;

      let cellClass = 'sensor-cell available';
      let statusText = '✓ Tersedia';
      let subText    = 'Klik untuk pilih';

      if (isBooked) {
        cellClass  = 'sensor-cell booked';
        statusText = '✗ Terpakai';
        subText    = 'Sudah dibooking';
        totalBooked++;
      } else if (isCancelled) {
        cellClass  = 'sensor-cell cancelled';
        statusText = '— Dibatalkan';
        subText    = 'Kosong kembali';
        totalCancelled++;
      }

      // Highlight jika ini pilihan user saat ini
      const isUserPick = booking.court === venue && booking.time === t && !isBooked;
      if (isUserPick) cellClass += ' user-selection';

      const clickAttr = (!isBooked && !isCancelled)
        ? `onclick="selectTimeAndCourtFromSensor('${venue}', '${t}')" style="cursor:pointer;"`
        : '';

      html += `
        <td ${clickAttr}>
          <div class="${cellClass}">
            <div class="sensor-cell-inner">
              <span class="sensor-cell-status">${statusText}</span>
            </div>
          </div>
        </td>
      `;
    });

    html += '</tr>';
  });

  html += '</tbody>';
  tableEl.innerHTML = html;

  // Summary bar
  const totalAvailable = totalSlots - totalBooked - totalCancelled;
  const occupancyPct   = Math.round(totalBooked / totalSlots * 100);
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="sensor-summary-stats">
        <div class="sensor-stat">
          <span class="sensor-stat-dot" style="background:#e8192e;box-shadow:0 0 5px rgba(232,25,46,0.5)"></span>
          <span class="sensor-stat-label">Terpakai</span>
          <span class="sensor-stat-value">${totalBooked}</span>
        </div>
        <div class="sensor-stat">
          <span class="sensor-stat-dot" style="background:#5dcaa5;box-shadow:0 0 5px rgba(93,202,165,0.4)"></span>
          <span class="sensor-stat-label">Tersedia</span>
          <span class="sensor-stat-value">${totalAvailable}</span>
        </div>
        <div class="sensor-stat">
          <span class="sensor-stat-dot" style="background:#444"></span>
          <span class="sensor-stat-label">Dibatalkan</span>
          <span class="sensor-stat-value">${totalCancelled}</span>
        </div>
        <div class="sensor-stat" style="margin-left: 0.5rem; padding-left: 1.2rem; border-left: 1px solid var(--border);">
          <span class="sensor-stat-label">Tingkat Pengisian</span>
          <span class="sensor-stat-value" style="color: ${occupancyPct > 70 ? '#e8192e' : '#5dcaa5'}">${occupancyPct}%</span>
        </div>
      </div>
      <div class="sensor-live-badge">
        <span class="sensor-live-dot"></span>
        LIVE · Diperbarui Otomatis
      </div>
    `;
  }

  // Tampilkan grid, sembunyikan idle state
  stateEl.style.display = 'none';
  gridEl.style.display  = 'block';
}

// Klik sel hijau di sensor langsung pilih lapangan & waktu sekaligus
function selectTimeAndCourtFromSensor(venue, time) {
  // Pilih time slot di form
  document.querySelectorAll('.time-slot').forEach(el => {
    if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(`'${time}'`)) {
      document.querySelectorAll('.time-slot.selected').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      booking.time = time;
    }
  });
  // Pilih lapangan di form
  document.querySelectorAll('.court-opt').forEach(el => {
    if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(`'${venue}'`)) {
      el.closest('.court-select').querySelectorAll('.court-opt.selected').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      booking.court = venue;
    }
  });
  updateSummary();
  highlightSensorSelection();
  // Scroll ke form booking
  document.querySelector('#booking .booking-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Highlight sel yang dipilih user di dalam sensor grid (tanpa reload data)
function highlightSensorSelection() {
  document.querySelectorAll('.sensor-cell').forEach(cell => {
    cell.classList.remove('user-selection');
  });
  if (!booking.court || !booking.time) return;

  const rows = document.querySelectorAll('#sensorTable tbody tr');
  rows.forEach(row => {
    const venueLabel = row.querySelector('.sensor-venue-label')?.textContent?.trim();
    const matchVenue = venueLabel && (
      venueLabel === (SENSOR_VENUE_SHORT[booking.court] || booking.court) ||
      venueLabel === booking.court
    );
    if (!matchVenue) return;
    const timeIdx = SENSOR_TIMESLOTS.indexOf(booking.time);
    if (timeIdx === -1) return;
    const cells = row.querySelectorAll('td:not(.sensor-venue-label)');
    const targetCell = cells[timeIdx]?.querySelector('.sensor-cell.available');
    if (targetCell) targetCell.classList.add('user-selection');
  });
}

/* ════════════════════════════════
   ANIMASI & INSINISIALISASI (ON LOAD)
════════════════════════════════ */
// Metode paling aman untuk animasi muncul saat di-scroll
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => { 
    if (entry.isIntersecting) {
      entry.target.classList.add('active'); 
      // Tambahkan efek fade in manual jika CSS belum siap
      entry.target.style.opacity = 1;
      entry.target.style.transform = "translateY(0)";
    }
  });
}, { threshold: 0.1 });

document.addEventListener("DOMContentLoaded", () => {
  // Pasang listener scroll
  document.querySelectorAll('.reveal').forEach(el => {
    el.style.opacity = 0; // Mulai sembunyi
    el.style.transform = "translateY(30px)";
    el.style.transition = "opacity 0.6s ease-out, transform 0.6s ease-out";
    revealObserver.observe(el);
  });
  
  // Render Kalender
  renderCalendar();
  
  // Ambil Data Sesi Terakhir (LocalStorage)
  const storedName = localStorage.getItem("userName");
  const storedMembership = localStorage.getItem("userMembership");

  if (window.isLoggedIn && storedName) {
    updateNavigationUI(storedName, storedMembership);
    
    // Tarik data dari Firebase (Jeda sebentar agar Firebase siap)
    setTimeout(() => {
      fetchMyBookingsFromCloud();
    }, 1000);
  } else {
    updateNavigationUI();
    // Kalau belum masuk, paksa tampilkan Popup Login
    openModal('login');
  }
});