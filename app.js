const video = document.getElementById('preview');
const canvas = document.getElementById('resultCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');

let photos = [];
let currentLayout = "1";

// Inicializar cámara (iPad frontal, 1280x960)
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 1280, height: 960 }
    });
    video.srcObject = stream;
  } catch (err) {
    alert("No se pudo acceder a la cámara: " + err.message);
  }
}
initCamera();

function drawImageCover(ctx, img, slot) {
  const canvasW = slot.w;
  const canvasH = slot.h;
  const imgRatio = img.width / img.height;   // 0.75 (3:4)
  const canvasRatio = canvasW / canvasH;     // 0.666... (2:3)

  let srcX, srcY, srcW, srcH;

  if (imgRatio > canvasRatio) {
    // Imagen más ancha → recortamos lados
    srcH = img.height;
    srcW = srcH * canvasRatio;
    srcX = (img.width - srcW) / 2;
    srcY = 0;
  } else {
    // Imagen más alta → recortamos arriba/abajo
    srcW = img.width;
    srcH = srcW / canvasRatio;
    srcX = 0;
    srcY = (img.height - srcH) / 2;
  }

  ctx.drawImage(img, srcX, srcY, srcW, srcH, slot.x, slot.y, canvasW, canvasH);
}


// Cronómetro
function countdown(seconds, message) {
  return new Promise(resolve => {
    const overlayMsg = document.createElement('div');
    overlayMsg.style.position = "fixed";
    overlayMsg.style.inset = "0";
    overlayMsg.style.background = "rgba(0,0,0,0.7)";
    overlayMsg.style.color = "#fff";
    overlayMsg.style.display = "flex";
    overlayMsg.style.flexDirection = "column";
    overlayMsg.style.alignItems = "center";
    overlayMsg.style.justifyContent = "center";
    overlayMsg.style.zIndex = "999";

    const msg = document.createElement('div');
    msg.textContent = message;
    msg.style.fontSize = "22px";
    const num = document.createElement('div');
    num.style.fontSize = "64px";

    overlayMsg.appendChild(msg);
    overlayMsg.appendChild(num);
    document.body.appendChild(overlayMsg);

    let remaining = seconds;
    num.textContent = remaining;
    const timer = setInterval(() => {
      remaining--;
      num.textContent = remaining;
      if (remaining < 0) {
        clearInterval(timer);
        document.body.removeChild(overlayMsg);
        resolve();
      }
    }, 1000);
  });
}

// Capturar foto en resolución frontal iPad (1280x960, 4:3)
function capturePhoto() {
  const temp = document.createElement('canvas');
  temp.width = 960;
  temp.height = 1280;
  const tctx = temp.getContext('2d');
  tctx.translate(temp.width, 0);
  tctx.scale(-1, 1); // espejo
  tctx.drawImage(video, 0, 0, temp.width, temp.height);
  return temp.toDataURL('image/jpeg', 0.95);
}

// Dibujar manteniendo proporción (✅ evita distorsión en iPad y móviles)
function drawImageFit(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const slotRatio = w / h;
  let drawW, drawH, offsetX, offsetY;

  if (imgRatio > slotRatio) {
    drawH = h;
    drawW = h * imgRatio;
    offsetX = x - (drawW - w) / 2;
    offsetY = y;
  } else {
    drawW = w;
    drawH = w / imgRatio;
    offsetX = x;
    offsetY = y - (drawH - h) / 2;
  }

  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
}

// Mostrar foto con transición (sin borrado automático)
function showPhotoWithOption(photo, index) {
  return new Promise(resolve => {
    overlay.style.background = "white";
    overlay.classList.add("show");
    setTimeout(() => {
      overlay.classList.remove("show");
      overlay.style.background = "black";

      video.style.display = "none";
      canvas.style.display = "block";

      ctx.fillStyle = "#f5f5dc";
      ctx.fillRect(0,0,canvas.width,canvas.height);

      photos[index] = photo;
      buildCollage(currentLayout, photos);

      const btn = document.createElement('button');
      btn.textContent = "❌ Repetir";
      btn.classList.add("repeat-btn");
      btn.style.position = "fixed";
      btn.style.bottom = "20px";
      btn.style.left = "50%";
      btn.style.transform = "translateX(-50%)";
      document.body.appendChild(btn);

      btn.onclick = ()=>{
        document.body.removeChild(btn);
        video.style.display = "block";
        canvas.style.display = "none";
        takePhoto(index).then(resolve);
      };
    }, 300);
  });
}

// Tomar foto
async function takePhoto(index) {
  video.style.display = "block";
  canvas.style.display = "none";

  await countdown(10, `Prepárate para la foto ${index+1}`);
  const photo = capturePhoto();
  await showPhotoWithOption(photo, index);
}

// Botón tomar foto
document.getElementById('startBtn').onclick = async () => {
  const index = photos.length;
  await takePhoto(index);
  buildCollage(currentLayout, photos);
};

// Botón imprimir
document.getElementById('printBtn').onclick = () => window.print();

// Botón descargar
document.getElementById('downloadBtn').onclick = () => {
  const link = document.createElement('a');
  link.download = "collage_4x6.jpg";
  link.href = canvas.toDataURL("image/jpeg", 0.95);
  link.click();
};

// Botón reiniciar
document.getElementById('resetBtn').onclick = () => {
  overlay.classList.add("show");
  setTimeout(() => {
    overlay.classList.remove("show");
    photos = [];
    ctx.fillStyle = "#f5f5dc";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    video.style.display = "block";
    canvas.style.display = "none";

    alert("Todo reiniciado. Escoge un formato y empieza de nuevo.");
  }, 500);
};

// Selector visual de formatos
document.querySelectorAll('.layout-option').forEach(option => {
  option.addEventListener('click', () => {
    currentLayout = option.dataset.layout;
    buildCollage(currentLayout, photos);
  });
});

// Construir collage según formato (✅ ahora usa drawImageFit en todos los slots)
function buildCollage(layout, photos) {
  ctx.fillStyle = "#f5f5dc";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  let slots = [];

  switch(layout) {
    case "1": slots = [{ x:0, y:0, w:1200, h:1800 }]; break;
    case "2": slots = [
      { x:562, y:176, w:588, h:911 },
      { x:36, y:697, w:588, h:911 }
    ]; break;
    case "3": slots = [
      { x:574, y:511, w:517, h:754 },
      { x:108, y:938, w:517, h:754 },
      { x:108, y:111, w:517, h:754 }
    ]; break;
    case "4": slots = [
      { x:0, y:0, w:602, h:903 },
      { x:600, y:0, w:600, h:900 },
      { x:0, y:900, w:600, h:900 },
      { x:600, y:900, w:600, h:900 }
    ]; break;
    case "8": slots = [
      { x:138, y:66, w:320, h:402 },
      { x:138, y:480, w:323, h:408 },
      { x:140, y:900, w:320, h:405 },
      { x:136, y:1319, w:322, h:406 },
      { x:736, y:72, w:320, h:402 },
      { x:737, y:484, w:323, h:408 },
      { x:738, y:900, w:320, h:405 },
      { x:739, y:1317, w:322, h:406 }
    ]; break;
  }

  slots.forEach((slot, i) => {
    const img = new Image();
    img.onload = () => {
      drawImageCover(ctx, img, slot); // ✅ rellena sin distorsión
    };
    if (layout === "8") {
      img.src = photos[i % 4] || "";
    } else {
      img.src = photos[i] || "";
    }
  });
}
