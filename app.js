// Remplace par l'URL de ton Worker Cloudflare après déploiement (voir README.md).
const WORKER_URL = "https://photo-pro-worker.paulwoisard.workers.dev";

const photoInput = document.getElementById("photo-input");
const dropzone = document.getElementById("dropzone");
const dropzoneText = document.getElementById("dropzone-text");
const preview = document.getElementById("preview");
const styleGrid = document.getElementById("style-grid");
const generateBtn = document.getElementById("generate-btn");
const statusText = document.getElementById("status-text");
const result = document.getElementById("result");
const resultImage = document.getElementById("result-image");
const downloadLink = document.getElementById("download-link");

let selectedFile = null;
let selectedStyleId = null;

function renderStyleGrid() {
  styleGrid.innerHTML = "";
  for (const style of STYLES) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "style-card";
    card.dataset.styleId = style.id;
    card.innerHTML = `
      <div class="before-after">
        <figure>
          <img src="${style.beforeImage}" alt="Avant" loading="lazy" />
          <figcaption>Avant</figcaption>
        </figure>
        <figure>
          <img src="${style.afterImage}" alt="Après" loading="lazy" />
          <figcaption>Après</figcaption>
        </figure>
      </div>
      <strong>${style.label}</strong>
      <span>${style.description}</span>
    `;
    card.addEventListener("click", () => selectStyle(style.id));
    styleGrid.appendChild(card);
  }
}

function selectStyle(styleId) {
  selectedStyleId = styleId;
  for (const card of styleGrid.children) {
    card.classList.toggle("selected", card.dataset.styleId === styleId);
  }
  updateGenerateAvailability();
}

function updateGenerateAvailability() {
  generateBtn.disabled = !(selectedFile && selectedStyleId);
}

photoInput.addEventListener("change", () => {
  const file = photoInput.files?.[0];
  if (!file) return;
  selectedFile = file;
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.hidden = false;
  dropzoneText.hidden = true;
  updateGenerateAvailability();
});

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragging");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragging"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragging");
  const file = e.dataTransfer.files?.[0];
  if (!file) return;
  photoInput.files = e.dataTransfer.files;
  photoInput.dispatchEvent(new Event("change"));
});

generateBtn.addEventListener("click", async () => {
  if (!selectedFile || !selectedStyleId) return;

  const style = STYLES.find((s) => s.id === selectedStyleId);
  generateBtn.disabled = true;
  result.hidden = true;
  statusText.textContent = "Chargement du profil de style...";

  try {
    const stpResponse = await fetch(style.stpFile);
    if (!stpResponse.ok) throw new Error(`Impossible de charger ${style.stpFile}`);
    const stpText = await stpResponse.text();

    statusText.textContent = "Génération en cours (peut prendre 20-40s)...";

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("stp", stpText);

    const response = await fetch(WORKER_URL, { method: "POST", body: formData });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Erreur serveur (${response.status})`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    resultImage.src = url;
    downloadLink.href = url;
    result.hidden = false;
    statusText.textContent = "";
  } catch (err) {
    statusText.textContent = `Erreur : ${err.message}`;
  } finally {
    generateBtn.disabled = false;
  }
});

renderStyleGrid();
