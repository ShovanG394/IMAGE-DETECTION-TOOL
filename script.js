let cvReady = false;

// Called when OpenCV loads
function onOpenCvReady() {
    cvReady = true;
    console.log("OpenCV.js is ready.");
}

const upload = document.getElementById("upload");
const dropArea = document.getElementById("dropArea");
const originalCanvas = document.getElementById("originalCanvas");
const edgeCanvas = document.getElementById("edgeCanvas");

const originalCtx = originalCanvas.getContext("2d");
const edgeCtx = edgeCanvas.getContext("2d");

const methodSelect = document.getElementById("method");
const cannyControls = document.getElementById("cannyControls");
const threshold1 = document.getElementById("threshold1");
const threshold2 = document.getElementById("threshold2");
const t1Value = document.getElementById("t1Value");
const t2Value = document.getElementById("t2Value");

const detectBtn = document.getElementById("detectBtn");
const downloadBtn = document.getElementById("downloadBtn");
const themeToggle = document.getElementById("themeToggle");

let img = new Image();

/* Theme Toggle */
themeToggle.onclick = () => {
    document.body.classList.toggle("dark");
};

/* Show/Hide Canny Controls */
methodSelect.addEventListener("change", () => {
    cannyControls.style.display =
        methodSelect.value === "canny" ? "block" : "none";
});

/* Update Threshold Values */
threshold1.oninput = () => t1Value.textContent = threshold1.value;
threshold2.oninput = () => t2Value.textContent = threshold2.value;

/* Drag & Drop Events */
dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropArea.style.background = "rgba(255,255,255,0.3)";
});

dropArea.addEventListener("dragleave", () => {
    dropArea.style.background = "";
});

dropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    dropArea.style.background = "";
    const file = e.dataTransfer.files[0];
    loadImage(file);
});

dropArea.addEventListener("click", () => upload.click());

upload.addEventListener("change", (e) => {
    loadImage(e.target.files[0]);
});

/* Load Image */
function loadImage(file) {
    if (!file || !file.type.startsWith("image/")) {
        alert("Please upload a valid image file.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        img = new Image();
        img.onload = () => drawImage();
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/* Draw Image on Canvas */
function drawImage() {
    const maxWidth = 500;
    const scale = Math.min(maxWidth / img.width, 1);

    const width = img.width * scale;
    const height = img.height * scale;

    originalCanvas.width = width;
    originalCanvas.height = height;
    edgeCanvas.width = width;
    edgeCanvas.height = height;

    originalCtx.drawImage(img, 0, 0, width, height);
}

/* Convert to Grayscale */
function toGrayscale(imageData) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = gray;
    }
    return imageData;
}

/* Convolution Function */
function applyConvolution(imageData, kernel) {
    const w = imageData.width;
    const h = imageData.height;
    const src = imageData.data;
    const output = new Uint8ClampedArray(src.length);
    const side = Math.sqrt(kernel.length);
    const half = Math.floor(side / 2);

    for (let y = half; y < h - half; y++) {
        for (let x = half; x < w - half; x++) {
            let sum = 0;

            for (let ky = 0; ky < side; ky++) {
                for (let kx = 0; kx < side; kx++) {
                    const px = ((y + ky - half) * w + (x + kx - half)) * 4;
                    sum += src[px] * kernel[ky * side + kx];
                }
            }

            const i = (y * w + x) * 4;
            const val = Math.min(Math.max(Math.abs(sum), 0), 255);
            output[i] = output[i + 1] = output[i + 2] = val;
            output[i + 3] = 255;
        }
    }

    return new ImageData(output, w, h);
}

/* Sobel Edge Detection */
function sobel(imageData) {
    const gx = [-1,0,1,-2,0,2,-1,0,1];
    const gy = [-1,-2,-1,0,0,0,1,2,1];
    const w = imageData.width;
    const h = imageData.height;
    const src = imageData.data;
    const out = new Uint8ClampedArray(src.length);

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            let sumX = 0, sumY = 0;

            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const i = ((y + ky) * w + (x + kx)) * 4;
                    const val = src[i];
                    const idx = (ky + 1) * 3 + (kx + 1);
                    sumX += val * gx[idx];
                    sumY += val * gy[idx];
                }
            }

            const magnitude = Math.sqrt(sumX ** 2 + sumY ** 2);
            const i = (y * w + x) * 4;
            const edge = Math.min(255, magnitude);

            out[i] = out[i + 1] = out[i + 2] = edge;
            out[i + 3] = 255;
        }
    }

    return new ImageData(out, w, h);
}

/* Apply Canny using OpenCV */
function applyCanny() {
    if (!cvReady || typeof cv === "undefined") {
        alert("OpenCV is still loading. Please wait.");
        return;
    }

    let src = cv.imread(originalCanvas);
    let gray = new cv.Mat();
    let edges = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.Canny(
        gray,
        edges,
        Number(threshold1.value),
        Number(threshold2.value)
    );

    cv.imshow(edgeCanvas, edges);

    src.delete();
    gray.delete();
    edges.delete();
}

/* Detect Edges */
detectBtn.onclick = () => {
    if (!img.src) {
        alert("Please upload an image first.");
        return;
    }

    const method = methodSelect.value;

    if (method === "canny") {
        applyCanny();
        return;
    }

    let imageData = originalCtx.getImageData(
        0, 0,
        originalCanvas.width,
        originalCanvas.height
    );

    imageData = toGrayscale(imageData);

    let result;

    if (method === "sobel") {
        result = sobel(imageData);
    } else if (method === "prewitt") {
        result = applyConvolution(imageData,
            [-1,0,1,-1,0,1,-1,0,1]);
    } else if (method === "laplacian") {
        result = applyConvolution(imageData,
            [0,-1,0,-1,4,-1,0,-1,0]);
    }

    edgeCtx.putImageData(result, 0, 0);
};

/* Download Image */
downloadBtn.onclick = () => {
    const link = document.createElement("a");
    link.download = "edge-detected-image.png";
    link.href = edgeCanvas.toDataURL("image/png");
    link.click();
};