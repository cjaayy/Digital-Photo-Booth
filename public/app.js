const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const captureBtn = document.getElementById("capture");
const printBtn = document.getElementById("printBtn");
const pdfBtn = document.getElementById("pdfBtn");
const deleteBtn = document.getElementById("deleteBtn");
const preview = document.getElementById("preview");
const printerSelect = document.getElementById("printerSelect");
const templateSelect = document.getElementById("templateSelect");
const borderSelect = document.getElementById("borderSelect");
const countdownEl = document.getElementById("countdown");
const flashEl = document.getElementById("flash");
const galleryEl = document.getElementById("gallery");

let currentDataUrl = null;
let isCapturing = false;

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
  } catch (e) {
    preview.innerText = "Camera access denied or not available.";
    console.error(e);
  }
}

captureBtn.addEventListener("click", () => {
  if (isCapturing) return; // prevent double-trigger
  isCapturing = true;
  captureBtn.disabled = true;
  startCountdown(3)
    .then(() => doCapture())
    .catch(() => {
      isCapturing = false;
      captureBtn.disabled = false;
    });
});

function doCapture() {
  const template = templateSelect ? templateSelect.value : "single";
  if (template === "single") {
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    currentDataUrl = canvas.toDataURL("image/png");
  } else if (template === "two") {
    composeMulti(2, 2);
    return;
  } else if (template === "four") {
    composeMulti(4, 2);
    return;
  } else if (template === "polaroid") {
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    const pW = w;
    const pH = h + Math.round(h * 0.18);
    const pCanvas = document.createElement("canvas");
    pCanvas.width = pW;
    pCanvas.height = pH;
    const pCtx = pCanvas.getContext("2d");
    pCtx.fillStyle = "white";
    pCtx.fillRect(0, 0, pW, pH);
    pCtx.drawImage(canvas, 0, 0, w, h);
    currentDataUrl = pCanvas.toDataURL("image/png");
  }
  // flash animation
  flashEl.style.transition = "none";
  flashEl.style.opacity = "0.9";
  requestAnimationFrame(() => {
    flashEl.style.transition = "opacity 400ms ease";
    flashEl.style.opacity = "0";
  });

  // determine selected border (apply to thumbnail + preview)
  const selected = borderSelect ? borderSelect.value : "none";
  const borderMap = {
    white: "border-white",
    rounded: "border-rounded",
    film: "border-film",
    vintage: "border-vintage",
  };
  const borderClass = borderMap[selected] || "";

  // add to gallery and preview (preview wrapped so border styles apply)
  const img = document.createElement("img");
  img.src = currentDataUrl;
  img.alt = "capture";
  preview.innerHTML = "";
  const pWrap = document.createElement("div");
  pWrap.className = "thumb preview-thumb";
  if (borderClass) pWrap.classList.add(borderClass);
  pWrap.appendChild(img);
  preview.appendChild(pWrap);
  addThumbnail(currentDataUrl, template);
  printBtn.disabled = false;
  pdfBtn.disabled = false;
  if (deleteBtn) deleteBtn.disabled = false;
  // finished capture
  isCapturing = false;
  captureBtn.disabled = false;
}

function startCountdown(n) {
  return new Promise((resolve) => {
    let i = n;
    countdownEl.style.opacity = 1;
    countdownEl.textContent = i > 0 ? i : "";
    const t = setInterval(() => {
      i--;
      countdownEl.textContent = i > 0 ? i : "";
      if (i <= 0) {
        clearInterval(t);
        countdownEl.style.opacity = 0;
        resolve();
      }
    }, 1000);
  });
}

function addThumbnail(dataUrl, template = "single") {
  const selected = borderSelect ? borderSelect.value : "none";
  const borderMap = {
    white: "border-white",
    rounded: "border-rounded",
    film: "border-film",
    vintage: "border-vintage",
  };
  const borderClass = borderMap[selected] || "";

  const wrap = document.createElement("div");
  wrap.className = "thumb";
  if (borderClass) wrap.classList.add(borderClass);
  if (template) wrap.dataset.template = template;
  if (borderClass) wrap.dataset.border = borderClass;

  const img = document.createElement("img");
  img.src = dataUrl;
  wrap.appendChild(img);
  wrap.addEventListener("click", () => {
    preview.innerHTML = "";
    const pWrap = document.createElement("div");
    pWrap.className = "thumb preview-thumb";
    const big = document.createElement("img");
    big.src = dataUrl;
    pWrap.appendChild(big);
    const b = wrap.dataset.border;
    if (b) pWrap.classList.add(b);
    preview.appendChild(pWrap);
    currentDataUrl = dataUrl;
    printBtn.disabled = false;
    pdfBtn.disabled = false;
    if (deleteBtn) deleteBtn.disabled = false;
  });
  galleryEl.insertBefore(wrap, galleryEl.firstChild);
}

async function composeMulti(count, perRow) {
  const imgs = [];
  for (let i = 0; i < count; i++) {
    await startCountdown(1);
    const w = video.videoWidth,
      h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    imgs.push(canvas.toDataURL("image/png"));
    flashEl.style.opacity = "0.8";
    setTimeout(() => (flashEl.style.opacity = "0"), 120);
  }
  const w = video.videoWidth;
  const h = video.videoHeight;
  const cols = perRow;
  const rows = Math.ceil(count / cols);
  const outW = cols * w;
  const outH = rows * h;
  const oCanvas = document.createElement("canvas");
  oCanvas.width = outW;
  oCanvas.height = outH;
  const oCtx = oCanvas.getContext("2d");
  // draw each image (ensure images are loaded)
  await Promise.all(
    imgs.map(
      (src, idx) =>
        new Promise((res) => {
          const im = new Image();
          im.onload = () => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            oCtx.drawImage(im, col * w, row * h, w, h);
            res();
          };
          im.src = src;
        })
    )
  );
  currentDataUrl = oCanvas.toDataURL("image/png");
  const el = document.createElement("img");
  el.src = currentDataUrl;
  preview.innerHTML = "";
  preview.appendChild(el);
  addThumbnail(currentDataUrl, `multi-${count}`);
  printBtn.disabled = false;
  pdfBtn.disabled = false;
  if (deleteBtn) deleteBtn.disabled = false;
  isCapturing = false;
  captureBtn.disabled = false;
}

if (deleteBtn) {
  deleteBtn.addEventListener("click", () => {
    currentDataUrl = null;
    preview.innerHTML = "";
    printBtn.disabled = true;
    pdfBtn.disabled = true;
    deleteBtn.disabled = true;
  });
}

printBtn.addEventListener("click", async () => {
  if (!currentDataUrl) return;
  // Send to server to print
  printBtn.disabled = true;
  printBtn.innerText = "Printing...";
  try {
    const res = await fetch("/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataUrl: currentDataUrl,
        printerName: printerSelect.value || undefined,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Print failed");
    preview.innerHTML += `<p>Sent to printer. File: ${body.file}</p>`;
  } catch (e) {
    preview.innerHTML += `<p class="error">${e.message}</p>`;
    // fallback: open print dialog
    const w = window.open("", "printwin");
    w.document.write(
      `<img src="${currentDataUrl}" onload="window.print();window.close()" />`
    );
  } finally {
    printBtn.disabled = false;
    printBtn.innerText = "Print";
  }
});

pdfBtn.addEventListener("click", async () => {
  if (!currentDataUrl) return;
  pdfBtn.disabled = true;
  pdfBtn.innerText = "Generating...";
  try {
    const res = await fetch("/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl: currentDataUrl, savePdf: true }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "PDF failed");
    // provide download link (server returns `url`)
    if (body.url) {
      const link = document.createElement("a");
      link.href = body.url;
      link.download = body.url.split("/").pop();
      link.textContent = "Download PDF";
      link.style.display = "block";
      link.style.marginTop = "0.5rem";
      preview.appendChild(link);
    } else {
      preview.innerHTML += `<p>PDF created: ${body.file}</p>`;
    }
  } catch (e) {
    preview.innerHTML += `<p class="error">${e.message}</p>`;
  } finally {
    pdfBtn.disabled = false;
    pdfBtn.innerText = "Save as PDF";
  }
});

async function loadPrinters() {
  try {
    const res = await fetch("/printers");
    const body = await res.json();
    const printers = body.printers || [];
    printerSelect.innerHTML = "";
    if (printers.length === 0) {
      const opt = document.createElement("option");
      opt.textContent = "No printers found (or not Windows)";
      opt.disabled = true;
      printerSelect.appendChild(opt);
    } else {
      printers.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        printerSelect.appendChild(opt);
      });
    }
  } catch (e) {
    printerSelect.innerHTML = "<option>Error loading printers</option>";
    console.error(e);
  }
}

startCamera();
loadPrinters();

// keyboard shortcut: space to capture
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    captureBtn.click();
  }
});
