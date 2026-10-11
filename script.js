// =====================
// CONFIGURACION
// =====================

// API REST Countries v5 (las versiones v1-v4 y v3.1 ya fueron retiradas).
// Documentación: https://restcountries.com/docs/countries
const API_URL = "https://api.restcountries.com/countries/v5";

// Con la API key. En restcountries.com > API Keys tuve que agregar como
// "allowed origins" los dominios desde donde se abre la página:
// localhost, 127.0.0.1 y jumilo807.github.io
// esto lo tuve que buscar con ayuda de la IA Gemini porque en la
// documentación de la API no lo explican muy bien y no cargaba la página.
const API_KEY = "rc_live_cc108260fd364a91b888d2d07610955c";

// Solo pido los campos que la app usa (respuesta más liviana).
const FIELDS = [
    "names.common",
    "names.native",
    "codes.alpha_3",
    "flag.url_png",
    "flag.url_svg",
    "flag.description",
    "population",
    "region",
    "subregion",
    "capitals",
    "tlds",
    "currencies",
    "languages",
    "borders"
].join(",");

// El plan gratuito permite máximo 100 paises por peticion. segun la documentación de la API, el límite máximo es 100.
const PAGE_SIZE = 100;

// Guardamos los datos en el navegador 24 h para no gastar cuota de la API. esto porque 
// la API gratuita tiene un límite de 1000 peticiones por mes, 
// y si cada vez que se abre la página se hace una petición, se gastaría la cuota muy rapido. 
const CACHE_KEY = "rest-countries-cache-v2";
const CACHE_TIME = 24 * 60 * 60 * 1000;
const NO_FLAG = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" fill="#d5dbe1"/><text x="160" y="108" font-family="Arial" font-size="20" fill="#5a6b7c" text-anchor="middle">Sin bandera</text></svg>');

// =====================
// ELEMENTOS DEL DOM
// =====================

const countriesContainer =
document.getElementById("countries");

const searchInput =
document.getElementById("search");

const regionSelect =
document.getElementById("region");

const themeBtn =
document.getElementById("theme-btn");

const themeLabel =
document.getElementById("theme-label");

const statusText =
document.getElementById("status");

const listView =
document.getElementById("list-view");

const detailView =
document.getElementById("detail-view");

const detailContainer =
document.getElementById("detail");

const backBtn =
document.getElementById("back-btn");

let countriesData = [];


// =====================
// OBTENER DATOS API
// =====================

async function getCountries() {

    showStatus("Cargando paises...");

    try {

        // 1. Intentar usar la copia guardada en cache
        const cached = readCache();

        if (cached) {
            countriesData = cached;
        } else {
            // 2. Si no hay cache, pedir todos los paises a la API
            const rawCountries = await fetchAllCountries();
            countriesData = rawCountries
                .map(normalizeCountry)
                .sort((a, b) => a.name.localeCompare(b.name));
            saveCache(countriesData);
        }

        filterCountries();
        router();

    } catch (error) {

        console.error(
            "Error al obtener paises",
            error
        );

        showStatus(
            "No se pudieron cargar los paises. " + error.message,
            true
        );

    }

}


// Pide los paises pagina por pagina (offset 0, 100, 200...)
// hasta que la API indique que no hay mas.
async function fetchAllCountries() {

    let all = [];
    let offset = 0;
    let more = true;

    while (more) {

        const url =
            `${API_URL}?limit=${PAGE_SIZE}` +
            `&offset=${offset}` +
            `&response_fields=${FIELDS}`;

        const response = await fetch(url, {
            headers: { "Authorization": `Bearer ${API_KEY}` }
        });

        const json = await response.json().catch(() => ({}));

        if (!response.ok) {
            const msg = json.errors && json.errors[0]
                ? json.errors[0].message
                : `HTTP ${response.status}`;
            throw new Error(msg);
        }

        // Con la key de prueba la API responde datos de ejemplo
        if (json.data && json.data._demo) {
            throw new Error(
                "La API respondio en modo demo: revisar que la API key sea valida."
            );
        }

        const objects = json.data.objects;
        all = all.concat(objects);

        const meta = json.data.meta || {};
        more = meta.more === true && objects.length > 0;
        offset += PAGE_SIZE;

    }

    return all;

}


// Convierte el objeto de la API v5 a una estructura simple
// que el resto de la app entiende.
function normalizeCountry(c) {

    const names = c.names || {};
    const native = names.native ? Object.values(names.native) : [];

    return {
        code: c.codes ? c.codes.alpha_3 : "",
        name: names.common || "Sin nombre",
        nativeName: native.length ? native[0].common : names.common,
        flag: (c.flag && (c.flag.url_svg || c.flag.url_png)) || NO_FLAG,
        flagAlt: c.flag && c.flag.description
            ? c.flag.description
            : `Bandera de ${names.common}`,
        population: c.population || 0,
        region: c.region || "",
        subregion: c.subregion || "",
        capital: (c.capitals || []).map(cap => cap.name),
        tld: c.tlds || [],
        currencies: (c.currencies || []).map(cur => cur.name),
        languages: (c.languages || []).map(lang => lang.name),
        borders: c.borders || []
    };

}


// =====================
// CACHE (localStorage)
// =====================

function readCache() {

    try {
        const saved = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (saved && Date.now() - saved.time < CACHE_TIME) {
            return saved.countries;
        }
    } catch (e) {
        // Si localStorage no esta disponible se sigue sin cache
    }
    return null;

}

function saveCache(countries) {

    try {
        localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ time: Date.now(), countries })
        );
    } catch (e) {
        // Sin espacio o bloqueado: no pasa nada
    }

}


// =====================
// MOSTRAR PAISES
// =====================

function displayCountries(countries) {

    countriesContainer.innerHTML = "";

    if (countries.length === 0) {
        showStatus("No se encontraron paises con esos filtros.");
        return;
    }

    hideStatus();

    countries.forEach(country => {

        const card =
        document.createElement(country.code ? "a" : "div");

        card.classList.add("card");
        if (country.code) card.href = `#/country/${country.code}`;

        card.innerHTML = `

            <img
                src="${country.flag}"
                alt="${escapeHTML(country.flagAlt)}"
                loading="lazy"
            >

            <div class="card-content">

                <h3>${escapeHTML(country.name)}</h3>

                <p>
                <strong>Población:</strong>
                ${country.population.toLocaleString("es-CO")}
                </p>

                <p>
                <strong>Región:</strong>
                ${escapeHTML(country.region)}
                </p>

                <p>
                <strong>Capital:</strong>
                ${country.capital.length
                    ? escapeHTML(country.capital[0])
                    : "No disponible"}
                </p>

            </div>

        `;

        countriesContainer.appendChild(card);

    });

}


// =====================
// DETALLE DEL PAIS
// =====================

function displayDetail(code) {

    const country =
    countriesData.find(c => c.code === code);

    if (!country) {
        detailContainer.innerHTML =
            "<p>Pais no encontrado.</p>";
        return;
    }

    // Botones de los paises vecinos (solo los que existen en los datos)
    const borderLinks = country.borders
        .map(b => countriesData.find(c => c.code === b))
        .filter(Boolean)
        .map(c =>
            `<a class="border-btn" href="#/country/${c.code}">${escapeHTML(c.name)}</a>`
        )
        .join("");

    detailContainer.innerHTML = `

        <img
            class="detail-flag"
            src="${country.flag}"
            alt="${escapeHTML(country.flagAlt)}"
        >

        <div class="detail-info">

            <h2>${escapeHTML(country.name)}</h2>

            <div class="detail-columns">

                <div>
                    <p><strong>Nombre nativo:</strong> ${escapeHTML(country.nativeName)}</p>
                    <p><strong>Población:</strong> ${country.population.toLocaleString("es-CO")}</p>
                    <p><strong>Región:</strong> ${escapeHTML(country.region)}</p>
                    <p><strong>Subregión:</strong> ${escapeHTML(country.subregion || "No disponible")}</p>
                    <p><strong>Capital:</strong> ${escapeHTML(listOrNA(country.capital))}</p>
                </div>

                <div>
                    <p><strong>Dominio:</strong> ${escapeHTML(listOrNA(country.tld))}</p>
                    <p><strong>Monedas:</strong> ${escapeHTML(listOrNA(country.currencies))}</p>
                    <p><strong>Idiomas:</strong> ${escapeHTML(listOrNA(country.languages))}</p>
                </div>

            </div>

            <div class="borders">
                <strong>Países fronterizos:</strong>
                ${borderLinks || "<span>Ninguno</span>"}
            </div>

        </div>

    `;

    window.scrollTo(0, 0);

}


// =====================
// NAVEGACION (hash)
// =====================

// #/country/COL  -> vista de detalle
// (vacio)        -> lista de paises
function router() {

    const match =
    location.hash.match(/^#\/country\/([A-Z]{3})$/);

    if (match && countriesData.length) {
        listView.classList.add("hidden");
        detailView.classList.remove("hidden");
        displayDetail(match[1]);
    } else {
        detailView.classList.add("hidden");
        listView.classList.remove("hidden");
    }

}

window.addEventListener("hashchange", router);

backBtn.addEventListener("click", () => {
    // Quitar el hash vuelve a la lista (dispara "hashchange")
    location.hash = "";
});


// =====================
// BUSCAR PAIS
// =====================

searchInput.addEventListener(
    "input",
    filterCountries
);


// =====================
// FILTRAR REGION
// =====================

regionSelect.addEventListener(
    "change",
    filterCountries
);


// =====================
// FILTROS
// =====================

function filterCountries() {

    const search =
    normalizeText(searchInput.value.trim());

    const region =
    regionSelect.value;

    const filtered =
    countriesData.filter(country => {

        const matchName =
        normalizeText(country.name).includes(search);

        const matchRegion =
        region === ""
        || country.region === region;

        return matchName && matchRegion;

    });

    displayCountries(filtered);

}


// =====================
// DARK MODE
// =====================

function applyTheme(dark) {

    document.body.classList.toggle("dark", dark);

    themeLabel.textContent =
        dark
        ? "Modo claro"
        : "Modo oscuro";

    themeBtn.setAttribute("aria-pressed", dark);

}

themeBtn.addEventListener("click", () => {

    const dark =
    !document.body.classList.contains("dark");

    applyTheme(dark);

    try {
        localStorage.setItem("theme", dark ? "dark" : "light");
    } catch (e) { /* sin localStorage */ }

});


// =====================
// UTILIDADES
// =====================

// Quita tildes y pasa a minúsculas: "Perú" -> "peru"
function normalizeText(text) {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

// Evita que texto de la API se interprete como HTML
function escapeHTML(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function listOrNA(list) {
    return list.length ? list.join(", ") : "No disponible";
}

function showStatus(message, isError = false) {
    statusText.textContent = message;
    statusText.classList.toggle("error", isError);
    statusText.classList.remove("hidden");
}

function hideStatus() {
    statusText.classList.add("hidden");
}


// =====================
// INICIAR APP
// =====================

let savedTheme = null;
try { savedTheme = localStorage.getItem("theme"); } catch (e) { /* nada */ }
applyTheme(savedTheme === "dark");

getCountries();
