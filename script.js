let html5QrCode;
let isScanning = false;
let todayData = [];
let activeViewData = [];
let torchOn = false;
let isMuted = false;
let audioCtx = null;
let lastScannedText = "";
let lastScannedTime = 0;

window.onload = () => {
  startLiveClock();
  checkDailyReset();
  loadTodayData();
  setTodayDatePickerDefault();
};

function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playBeepSound() {
  if (isMuted) return;
  try {
    initAudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    console.log("Audio play error:", e);
  }
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

function switchPage(pageId) {
  document
    .querySelectorAll(".page-view")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");

  if (pageId !== "page-scanner" && isScanning) {
    stopScanner();
  }
}

function startLiveClock() {
  setInterval(() => {
    const now = new Date();
    document.getElementById("liveClock").innerText =
      now.toLocaleTimeString("id-ID");
  }, 1000);
}

function triggerVisualFlash() {
  const box = document.getElementById("scanBox");
  box.classList.add("flash-success");
  setTimeout(() => box.classList.remove("flash-success"), 450);
}

function toggleAudioMute() {
  isMuted = !isMuted;
  document.getElementById("muteBtn").innerHTML = isMuted
    ? '<i class="fa-solid fa-volume-xmark"></i> Audio: OFF'
    : '<i class="fa-solid fa-volume-high"></i> Audio: ON';
}

function getFormattedDate(d = new Date()) {
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function checkDailyReset() {
  const today = new Date().toLocaleDateString("id-ID");
  const savedDate = localStorage.getItem("nexus_scan_date");

  if (savedDate && savedDate !== today) {
    let oldData = JSON.parse(localStorage.getItem("nexus_today_data") || "[]");
    if (oldData.length > 0) {
      let archive = JSON.parse(
        localStorage.getItem("nexus_archive_db") || "{}",
      );
      archive[savedDate] = oldData;
      localStorage.setItem("nexus_archive_db", JSON.stringify(archive));
    }
    localStorage.setItem("nexus_today_data", JSON.stringify([]));
  }
  localStorage.setItem("nexus_scan_date", today);
}

function loadTodayData() {
  todayData = JSON.parse(localStorage.getItem("nexus_today_data") || "[]");
  activeViewData = [...todayData];
  renderList();
}

function setTodayDatePickerDefault() {
  const todayStr = new Date().toISOString().split("T")[0];
  document.getElementById("dateFilterInput").value = todayStr;
}

function filterBySelectedDate() {
  const selectedVal = document.getElementById("dateFilterInput").value;
  if (!selectedVal) return;

  const dateObj = new Date(selectedVal);
  const dateFormatted = dateObj.toLocaleDateString("id-ID");
  const todayFormatted = new Date().toLocaleDateString("id-ID");

  if (dateFormatted === todayFormatted) {
    activeViewData = [...todayData];
    document.getElementById("currentDateBadge").innerText = "Hari Ini";
  } else {
    const archive = JSON.parse(
      localStorage.getItem("nexus_archive_db") || "{}",
    );
    activeViewData = archive[dateFormatted] || [];
    document.getElementById("currentDateBadge").innerText =
      getFormattedDate(dateObj);
  }
  renderList();
}

function toggleScanner() {
  initAudioContext();
  if (isScanning) stopScanner();
  else startScanner();
}

function startScanner() {
  if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");

  const qrboxFunction = function (viewfinderWidth, viewfinderHeight) {
    let minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
    let qrboxSize = Math.floor(minEdgeSize * 0.85);
    return {
      width: qrboxSize,
      height: qrboxSize,
    };
  };

  const config = {
    fps: 30,
    qrbox: qrboxFunction,
    disableFlip: false,
  };

  html5QrCode
    .start({ facingMode: "environment" }, config, onScanSuccess)
    .then(() => {
      isScanning = true;
      document.getElementById("camToggleBtn").innerHTML =
        '<i class="fa-solid fa-xmark"></i> Tutup Scanner';
      document.getElementById("camToggleBtn").className =
        "btn-custom btn-danger";
      document.getElementById("scanBox").classList.add("active");
    })
    .catch(() =>
      alert("Gagal mengakses kamera. Pastikan izin kamera telah diberikan."),
    );
}

function stopScanner() {
  if (html5QrCode && isScanning) {
    html5QrCode.stop().then(() => {
      isScanning = false;
      document.getElementById("camToggleBtn").innerHTML =
        '<i class="fa-solid fa-camera"></i> Mulai Scanner';
      document.getElementById("camToggleBtn").className = "btn-custom";
      document.getElementById("scanBox").classList.remove("active");
    });
  }
}

// === FUNGSI FETCH KE BACKEND ===
async function simpanScanKeServer(scanData) {
  try {
    const payload = {
      raw_text: scanData.rawText,
      detail_json: scanData.fields,
      waktu_scan: scanData.time,
    };

    const response = await fetch("simpan_scan.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (result.status !== "success") {
      console.error("Gagal sinkronisasi data ke server: ", result.message);
    }
  } catch (error) {
    console.error("Error Fetch API Scanner:", error);
  }
}

function onScanSuccess(decodedText) {
  const now = Date.now();
  if (decodedText === lastScannedText && now - lastScannedTime < 1500) {
    return;
  }

  lastScannedText = decodedText;
  lastScannedTime = now;

  playBeepSound();
  triggerVisualFlash();
  if (navigator.vibrate) navigator.vibrate([100]);

  const isDuplicate = todayData.some((item) => item.rawText === decodedText);
  if (isDuplicate) {
    showToast("⚠️ Peringatan: Data sudah di-scan!");
    return;
  }

  let fields = [];
  let firstVal = decodedText;
  let lines = decodedText.split(/\r?\n/);

  lines.forEach((line) => {
    if (!line.trim()) return;
    let parts = line.split(/[:=]/);
    if (parts.length > 1) {
      let label = parts[0].trim();
      let val = parts.slice(1).join(":").trim();
      fields.push({ label: label, value: val });
      if (firstVal === decodedText) firstVal = val;
    } else {
      fields.push({ label: "Isi / Raw Data", value: line.trim() });
    }
  });

  const newScanData = {
    id: Date.now(),
    rawText: decodedText,
    fields: fields,
    firstVal: firstVal,
    time: new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };

  todayData.unshift(newScanData);
  localStorage.setItem("nexus_today_data", JSON.stringify(todayData));

  setTodayDatePickerDefault();
  activeViewData = [...todayData];

  renderList();
  showToast("✅ Scan Berhasil Terekam!");

  // === PANGGIL FUNGSI SERVER DI SINI ===
  simpanScanKeServer(newScanData);
}

async function scanFromFile(input) {
  if (!input.files || input.files.length === 0) return;

  initAudioContext();
  const file = input.files[0];
  showToast("🔍 Memproses Gambar...");

  try {
    const fileScanner = new Html5Qrcode("file-scanner-temp");
    const decodedText = await fileScanner.scanFile(file, true);
    onScanSuccess(decodedText);
    fileScanner.clear();
  } catch (err) {
    alert("❌ Barcode tidak terdeteksi pada gambar ini.");
  } finally {
    input.value = "";
  }
}

function toggleTorch() {
  if (html5QrCode && isScanning) {
    torchOn = !torchOn;
    html5QrCode
      .applyVideoConstraints({ advanced: [{ torch: torchOn }] })
      .catch(() => alert("Senter tidak tersedia pada perangkat ini."));
  } else alert("Nyalakan kamera scanner terlebih dahulu.");
}

function renderList() {
  const containerHome = document.getElementById("scanListHome");
  const containerHistory = document.getElementById("scanListHistory");
  const searchQuery = document
    .getElementById("searchInput")
    .value.toLowerCase();

  document.getElementById("statTotalScanHome").innerText = todayData.length;
  document.getElementById("statTotalScanHistory").innerText =
    activeViewData.length;

  let filteredData = activeViewData.filter((item) =>
    item.rawText.toLowerCase().includes(searchQuery),
  );

  let htmlContent = "";
  if (filteredData.length === 0) {
    htmlContent = `<div style="text-align:center; padding: 24px; color: var(--text-muted); font-size:12px;">Data belum ada / tidak ditemukan.</div>`;
  } else {
    filteredData.forEach((item) => {
      let rowsHtml = "";
      if (item.fields) {
        item.fields.forEach((f) => {
          rowsHtml += `<div class="data-row"><span class="data-label">${f.label}</span><span class="data-val">${f.value}</span></div>`;
        });
      }

      htmlContent += `
        <div class="card-item">
          ${rowsHtml}
          <div class="data-row"><span class="data-label">Waktu Scan</span><span class="data-val">${item.time}</span></div>
          <div class="card-action-bar">
            <button class="btn-icon-action" onclick="copyToClipboard('${encodeURIComponent(item.rawText)}')"><i class="fa-regular fa-copy"></i> Salin</button>
            <button class="btn-icon-action" style="color:var(--neon-red);" onclick="deleteCard(${item.id})"><i class="fa-solid fa-trash"></i> Hapus</button>
          </div>
        </div>
      `;
    });
  }

  if (containerHome) containerHome.innerHTML = htmlContent;
  if (containerHistory) containerHistory.innerHTML = htmlContent;
}

function copyToClipboard(encodedText) {
  const text = decodeURIComponent(encodedText);
  navigator.clipboard
    .writeText(text)
    .then(() => showToast("📋 Teks berhasil disalin!"));
}

function deleteCard(id) {
  if (confirm("Hapus baris data ini?")) {
    todayData = todayData.filter((item) => item.id !== id);
    activeViewData = activeViewData.filter((item) => item.id !== id);
    localStorage.setItem("nexus_today_data", JSON.stringify(todayData));
    renderList();
    showToast("Data Terhapus!");
  }
}

function confirmResetData() {
  if (confirm("Apakah Anda yakin ingin menghapus data scan HARI INI?")) {
    todayData = [];
    activeViewData = [];
    localStorage.setItem("nexus_today_data", JSON.stringify([]));
    renderList();
    showToast("🧹 Data Scan Hari Ini Dikosongkan!");
  }
}

/* EXPORT MODALS */
function openExcelOptionsModal() {
  if (activeViewData.length === 0) return alert("⚠️ Data masih kosong.");
  document.getElementById("excelModal").style.display = "flex";
}

function openPDFOptionsModal() {
  if (activeViewData.length === 0) return alert("⚠️ Data masih kosong.");
  document.getElementById("pdfModal").style.display = "flex";
}

function closeModals() {
  document.getElementById("excelModal").style.display = "none";
  document.getElementById("pdfModal").style.display = "none";
}

function prepareExcelData(dataArray) {
  return dataArray.map((item, index) => {
    let rowObj = { No: index + 1 };
    if (item.fields) {
      item.fields.forEach((f) => {
        rowObj[f.label] = f.value;
      });
    } else {
      rowObj["Raw Data"] = item.rawText;
    }
    return rowObj;
  });
}

async function saveFileWithPicker(
  blobData,
  defaultFilename,
  mimeType,
  extension,
) {
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [
          {
            description: "File Laporan",
            accept: { [mimeType]: [extension] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blobData);
      await writable.close();
      showToast("📊 File Berhasil Disimpan di Lokasi Pilihan!");
      return true;
    } catch (err) {
      if (err.name === "AbortError") return false;
    }
  }

  const url = URL.createObjectURL(blobData);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("📊 Berhasil Mengunduh File!");
}

async function exportToExcel() {
  const excelData = prepareExcelData(activeViewData);

  const headerInfo = [
    ["PT DAYA SAKTI NIAGA"],
    ["LAPORAN HASIL PEMINDAIAN BARCODE"],
    [`Tanggal Scan: ${getFormattedDate()}`],
    [`Waktu Ekspor Laporan: ${new Date().toLocaleTimeString("id-ID")}`],
    [],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(headerInfo);
  XLSX.utils.sheet_add_json(worksheet, excelData, { origin: "A6" });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Hasil Scan");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const defaultFilename = `Laporan_Scan_${getFormattedDate().replace(/ /g, "_")}.xlsx`;
  await saveFileWithPicker(
    blob,
    defaultFilename,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xlsx",
  );
}

async function shareExcelFile() {
  const excelData = prepareExcelData(activeViewData);

  const headerInfo = [
    ["PT DAYA SAKTI NIAGA"],
    ["LAPORAN HASIL PEMINDAIAN BARCODE"],
    [`Tanggal Scan: ${getFormattedDate()}`],
    [`Waktu Ekspor Laporan: ${new Date().toLocaleTimeString("id-ID")}`],
    [],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(headerInfo);
  XLSX.utils.sheet_add_json(worksheet, excelData, { origin: "A6" });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Hasil Scan");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const file = new File(
    [excelBuffer],
    `Laporan_Scan_${getFormattedDate().replace(/ /g, "_")}.xlsx`,
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: "Laporan Scan Excel",
        text: `File Excel Hasil Scan Barcode PT DAYA SAKTI NIAGA (${getFormattedDate()})`,
        files: [file],
      });
      showToast("🚀 Berhasil Membagikan File!");
    } catch (err) {
      if (err.name !== "AbortError") alert("Gagal membagikan file.");
    }
  } else {
    alert(
      "Perangkat ini tidak mendukung kirim file langsung. Menampilkan dialog lokasi simpan file...",
    );
    exportToExcel();
  }
}

async function exportToPDF() {
  showToast("📄 Memproses File PDF...");

  document.getElementById("pdfReportDate").innerText =
    `Tanggal Laporan: ${getFormattedDate()}`;
  document.getElementById("pdfReportMeta").innerText =
    `Waktu Ekspor Laporan: ${new Date().toLocaleTimeString("id-ID")}`;

  const pdfTbody = document.getElementById("pdfReportBody");
  pdfTbody.innerHTML = "";

  activeViewData.forEach((item, index) => {
    let textDisplay = item.rawText.replace(/\n/g, "<br>");
    pdfTbody.innerHTML += `
      <tr>
        <td align="center">${index + 1}</td>
        <td>${textDisplay}</td>
      </tr>
    `;
  });

  const element = document.getElementById("pdfReportTemplate");
  element.style.display = "block";

  const defaultFilename = `Laporan_Scan_${getFormattedDate().replace(/ /g, "_")}.pdf`;

  const opt = {
    margin: 10,
    filename: defaultFilename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };

  try {
    const pdfBlob = await html2pdf().set(opt).from(element).output("blob");
    element.style.display = "none";
    await saveFileWithPicker(
      pdfBlob,
      defaultFilename,
      "application/pdf",
      ".pdf",
    );
  } catch (e) {
    element.style.display = "none";
    alert("Gagal memproses file PDF.");
  }
}

async function sharePDFFile() {
  showToast("📄 Memproses PDF untuk WhatsApp...");

  document.getElementById("pdfReportDate").innerText =
    `Tanggal Laporan: ${getFormattedDate()}`;
  document.getElementById("pdfReportMeta").innerText =
    `Waktu Ekspor Laporan: ${new Date().toLocaleTimeString("id-ID")}`;

  const pdfTbody = document.getElementById("pdfReportBody");
  pdfTbody.innerHTML = "";

  activeViewData.forEach((item, index) => {
    let textDisplay = item.rawText.replace(/\n/g, "<br>");
    pdfTbody.innerHTML += `
      <tr>
        <td align="center">${index + 1}</td>
        <td>${textDisplay}</td>
      </tr>
    `;
  });

  const element = document.getElementById("pdfReportTemplate");
  element.style.display = "block";

  const opt = {
    margin: 10,
    filename: `Laporan_Scan_${getFormattedDate().replace(/ /g, "_")}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };

  try {
    const pdfBlob = await html2pdf().set(opt).from(element).output("blob");
    element.style.display = "none";

    const file = new File(
      [pdfBlob],
      `Laporan_Scan_${getFormattedDate().replace(/ /g, "_")}.pdf`,
      { type: "application/pdf" },
    );

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "Laporan Scan PDF",
        text: `File PDF Hasil Scan Barcode PT DAYA SAKTI NIAGA (${getFormattedDate()})`,
        files: [file],
      });
      showToast("🚀 Berhasil Membagikan File PDF!");
    } else {
      alert(
        "Perangkat ini tidak mendukung kirim file PDF langsung. Menampilkan dialog lokasi simpan file...",
      );
      exportToPDF();
    }
  } catch (e) {
    element.style.display = "none";
    alert("Gagal membagikan PDF.");
  }
}
