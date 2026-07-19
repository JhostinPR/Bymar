// ===============================
// INVENTARIO WEB (conectado a Firebase Firestore)
// ===============================

import { db } from "./firebase-Config.js";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Colección de Firestore donde viven los productos
const productosRef = collection(db, "productos");

// Colección de Firestore donde vive el historial de ventas
const ventasRef = collection(db, "ventas");

// Placeholder propio (no depende de internet)
const SIN_IMAGEN =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="250">
        <rect width="400" height="250" fill="#EFEFEA"/>
        <text x="50%" y="50%" font-family="Inter, sans-serif" font-size="16"
            fill="#9CA3AF" text-anchor="middle" dominant-baseline="middle">
            Sin imagen
        </text>
    </svg>
    `);

// Elementos principales

const modal = document.getElementById("modal");
const btnAgregar = document.getElementById("btnAgregar");
const cerrar = document.querySelector(".cerrar");
const tituloModal = document.getElementById("tituloModal");

const btnMenu = document.getElementById("btnMenu");
const dropdownMenu = document.getElementById("dropdownMenu");
const btnModoEdicion = document.getElementById("btnModoEdicion");
const textoModoEdicion = document.getElementById("textoModoEdicion");

const formulario = document.getElementById("formProducto");

const nombre = document.getElementById("nombre");
const precio = document.getElementById("precio");
const cantidad = document.getElementById("cantidad");
const descripcion = document.getElementById("descripcion");
const imagen = document.getElementById("imagen");
const preview = document.getElementById("preview");
const facebookLink = document.getElementById("facebookLink");

const contenedor = document.getElementById("contenedorProductos");

const buscar = document.getElementById("buscar");

const totalProductos = document.getElementById("totalProductos");
const valorInventario = document.getElementById("valorInventario");

// --- Nuevos elementos: vista de catálogo, ventas y Modo Inventario ---
const contenedorCatalogo = document.getElementById("contenedorCatalogo");
const contenedorVentas = document.getElementById("contenedorVentas");

// --- Pestañas dentro de la vista Ventas: Registrar venta / Historial ---
const contenedorVenderProductos = document.getElementById("contenedorVenderProductos");
const tabRegistrarVenta = document.getElementById("tabRegistrarVenta");
const tabHistorialVentas = document.getElementById("tabHistorialVentas");
const subVistaRegistrar = document.getElementById("subVistaRegistrar");
const subVistaHistorial = document.getElementById("subVistaHistorial");

const totalVentasMes = document.getElementById("totalVentasMes");
const montoVentasMes = document.getElementById("montoVentasMes");

const btnModoInventario = document.getElementById("btnModoInventario");
const textoModoInventario = document.getElementById("textoModoInventario");

const navInicio = document.getElementById("navInicio");
const navProductos = document.getElementById("navProductos");
const navVentas = document.getElementById("navVentas");

// Botones del menú inferior (solo visible en celular)
const bottomNavItems = document.querySelectorAll(".bottom-nav-item");

// ===============================
// TOASTS (reemplazan a alert())
// ===============================

const toastContainer = document.createElement("div");
toastContainer.className = "toast-container";
document.body.appendChild(toastContainer);

const ICONOS_TOAST = {
    exito: "fa-solid fa-circle-check",
    error: "fa-solid fa-circle-exclamation",
    advertencia: "fa-solid fa-triangle-exclamation"
};

function mostrarToast(mensaje, tipo = "error", duracion = 4500) {
    const toast = document.createElement("div");
    toast.className = `toast ${tipo}`;

    toast.innerHTML = `
    <i class="${ICONOS_TOAST[tipo] || ICONOS_TOAST.error}"></i>
    <div class="toast-texto">${mensaje}</div>
    <span class="toast-cerrar">&times;</span>
    `;

    function quitar() {
        toast.classList.add("saliendo");
        setTimeout(() => toast.remove(), 200);
    }

    toast.querySelector(".toast-cerrar").onclick = quitar;
    setTimeout(quitar, duracion);

    toastContainer.appendChild(toast);
}

// ===============================
// CONFIRMACIÓN (reemplaza a confirm())
// ===============================
// Devuelve una Promise<boolean>: true si el usuario acepta.
// tipo "danger" (rojo, para eliminar) o "primary" (verde, para vender).
// ===============================

function mostrarConfirmacion({
    titulo = "¿Estás seguro?",
    mensaje = "",
    tipo = "danger",
    textoAceptar = "Aceptar",
    textoCancelar = "Cancelar"
}) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = `modal confirmacion ${tipo === "primary" ? "tipo-primary" : ""}`;
        overlay.style.display = "flex";

        overlay.innerHTML = `
        <div class="modal-contenido">
            <div class="confirmacion-icono">
                <i class="fa-solid ${tipo === "primary" ? "fa-cash-register" : "fa-triangle-exclamation"}"></i>
            </div>
            <h2>${titulo}</h2>
            <p>${mensaje}</p>
            <div class="confirmacion-botones">
                <button type="button" class="confirmacion-cancelar">${textoCancelar}</button>
                <button type="button" class="confirmacion-aceptar">${textoAceptar}</button>
            </div>
        </div>
        `;

        function cerrar(resultado) {
            document.removeEventListener("keydown", porEscape);
            overlay.remove();
            resolve(resultado);
        }

        function porEscape(e) {
            if (e.key === "Escape") cerrar(false);
        }

        overlay.querySelector(".confirmacion-cancelar").onclick = () => cerrar(false);
        overlay.querySelector(".confirmacion-aceptar").onclick = () => cerrar(true);
        overlay.onclick = (e) => {
            if (e.target === overlay) cerrar(false);
        };

        document.addEventListener("keydown", porEscape);
        document.body.appendChild(overlay);
    });
}

// ===============================

// Copia local de lo que hay en Firestore (se llena sola con onSnapshot)
let productos = [];

// Guarda el id del documento que se está editando (null = producto nuevo)
let idEditar = null;

// Evita que al picar varias veces "Guardar" se creen productos repetidos
let guardando = false;
const btnGuardar = formulario.querySelector('button[type="submit"]');

// ===============================

btnAgregar.onclick = function () {
    cerrarMenu();
    abrirModal();
};

cerrar.onclick = cerrarModal;

window.onclick = function (e) {
    if (e.target === modal) {
        cerrarModal();
    }

    // Si el clic fue fuera del menú, lo cerramos
    if (!menuAcciones.contains(e.target)) {
        cerrarMenu();
    }
};

// ===============================
// MENU SUPERIOR (agregar producto / modo edición)
// ===============================

const menuAcciones = document.querySelector(".menu-acciones");

btnMenu.onclick = function (e) {
    e.stopPropagation();
    dropdownMenu.classList.toggle("abierto");
    btnMenu.classList.toggle("activo");
};

function cerrarMenu() {
    dropdownMenu.classList.remove("abierto");
    btnMenu.classList.remove("activo");
}

// El "modo edición" muestra/oculta los botones de Editar y Eliminar
// en las tarjetas. Al entrar a la página, esos botones están ocultos
// para que solo se vea el catálogo.
btnModoEdicion.onclick = function () {
    const activo = document.body.classList.toggle("modo-edicion");

    btnModoEdicion.classList.toggle("activo", activo);
    textoModoEdicion.textContent = activo ? "Desactivar edición" : "Activar edición";

    cerrarMenu();
};

// ===============================

function abrirModal() {
    tituloModal.textContent =
        idEditar === null ? "Agregar Producto" : "Editar Producto";
    modal.style.display = "flex";
}

// ===============================

function cerrarModal() {
    modal.style.display = "none";
    formulario.reset();
    preview.style.display = "none";
    preview.src = "";
    idEditar = null;
}

// ===============================
// Al elegir una foto: la redimensionamos y comprimimos antes de
// guardarla, porque Firestore solo acepta ~1MB por producto y una
// foto de celular sin comprimir se pasa fácil de ese límite.
// ===============================

imagen.addEventListener("change", function () {
    const archivo = this.files[0];

    if (!archivo) {
        return;
    }

    const lector = new FileReader();

    lector.onload = function (e) {
        const img = new Image();

        img.onload = function () {
            const MAX_LADO = 800;
            let ancho = img.width;
            let alto = img.height;

            if (ancho > alto && ancho > MAX_LADO) {
                alto = Math.round((alto * MAX_LADO) / ancho);
                ancho = MAX_LADO;
            } else if (alto > MAX_LADO) {
                ancho = Math.round((ancho * MAX_LADO) / alto);
                alto = MAX_LADO;
            }

            const canvas = document.createElement("canvas");
            canvas.width = ancho;
            canvas.height = alto;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, ancho, alto);

            // 0.7 de calidad JPEG: buen balance entre tamaño y nitidez
            const comprimida = canvas.toDataURL("image/jpeg", 0.7);

            preview.src = comprimida;
            preview.style.display = "block";
        };

        img.src = e.target.result;
    };

    lector.readAsDataURL(archivo);
});

// ===============================

formulario.addEventListener("submit", guardarProducto);

// ===============================
// Nota: antes había aquí un scrollIntoView() automático al enfocar
// cada campo del formulario, pensado para que el teclado del celular
// no lo tapara. Se quitó porque hacía que la pantalla "brincara" sola
// mientras escribías. El modal ya tiene overflow-y:auto, así que el
// navegador se encarga solo de mostrar el campo activo.
// ===============================

async function guardarProducto(e) {
    e.preventDefault();

    // Si ya se está guardando, ignoramos clics extra
    if (guardando) {
        return;
    }

    if (nombre.value.trim() === "") {
        mostrarToast("Escribe un nombre.", "advertencia");
        return;
    }

    if (precio.value === "") {
        mostrarToast("Escribe un precio.", "advertencia");
        return;
    }

    if (cantidad.value === "") {
        mostrarToast("Escribe una cantidad.", "advertencia");
        return;
    }

    let imagenBase64 = "";

    if (preview.src !== "" && preview.style.display !== "none") {
        imagenBase64 = preview.src;
    }

    const producto = {
        nombre: nombre.value.trim(),
        precio: Number(precio.value),
        cantidad: Number(cantidad.value),
        descripcion: descripcion.value.trim(),
        imagen: imagenBase64,
        facebookLink: facebookLink.value.trim(),
        fecha: new Date().toLocaleDateString()
    };

    guardando = true;
    btnGuardar.disabled = true;
    btnGuardar.textContent = "Guardando...";

    try {
        if (idEditar === null) {
            producto.creado = Date.now();
            await addDoc(productosRef, producto);
        } else {
            await updateDoc(doc(db, "productos", idEditar), producto);
        }

        cerrarModal();
    } catch (error) {
        console.error("Error al guardar en Firestore:", error);
        mostrarToast("No se pudo guardar el producto. Revisa tu conexión o las reglas de Firestore.", "error");
    } finally {
        guardando = false;
        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar Producto";
    }
}

// ===============================

function estadoStock(cant) {
    if (cant <= 0) return "agotado";
    if (cant <= 5) return "bajo";
    return "ok";
}

function etiquetaStock(cant) {
    if (cant <= 0) return "Agotado";
    if (cant <= 5) return "Stock bajo";
    return "Disponible";
}

// ===============================

function mostrarProductos() {
    contenedor.innerHTML = "";

    if (productos.length === 0) {
        contenedor.innerHTML = `
        <div class="sinProductos">
            <h2>No hay productos todavía</h2>
            <p>Presiona "Agregar Producto" para empezar.</p>
        </div>
        `;
        return;
    }

    productos.forEach((producto) => {
        const tarjeta = document.createElement("div");
        const estado = estadoStock(producto.cantidad);

        tarjeta.className = "producto" + (estado !== "ok" ? " " + estado : "");

        const foto = producto.imagen !== "" ? producto.imagen : SIN_IMAGEN;

        tarjeta.innerHTML = `
        <div class="foto">
            <img src="${foto}">
            <span class="estado ${estado !== "ok" ? estado : ""}">${etiquetaStock(producto.cantidad)}</span>
        </div>
        <div class="info">
            <h3>${producto.nombre}</h3>
            <p class="precio-tag">$${producto.precio.toLocaleString()}</p>
            <p><b>Cantidad:</b> ${producto.cantidad}</p>
            ${producto.descripcion ? `<p>${producto.descripcion}</p>` : ""}
            <div class="botones">
                <button class="editar">Editar</button>
                <button class="eliminar">Eliminar</button>
            </div>
        </div>
        `;

        const btnEditar = tarjeta.querySelector(".editar");
        const btnEliminar = tarjeta.querySelector(".eliminar");

        btnEditar.onclick = function () {
            editarProducto(producto.id);
        };

        btnEliminar.onclick = function () {
            eliminarProducto(producto.id);
        };

        contenedor.appendChild(tarjeta);
    });
}

// ===============================

function editarProducto(id) {
    const producto = productos.find((p) => p.id === id);
    if (!producto) return;

    idEditar = id;

    nombre.value = producto.nombre;
    precio.value = producto.precio;
    cantidad.value = producto.cantidad;
    descripcion.value = producto.descripcion;
    facebookLink.value = producto.facebookLink || "";

    if (producto.imagen !== "") {
        preview.src = producto.imagen;
        preview.style.display = "block";
    } else {
        preview.style.display = "none";
        preview.src = "";
    }

    abrirModal();
}

// ===============================

async function eliminarProducto(id) {
    const producto = productos.find((p) => p.id === id);
    if (!producto) return;

    const confirmar = await mostrarConfirmacion({
        titulo: "Eliminar producto",
        mensaje: `¿Eliminar "${producto.nombre}"? Esta acción no se puede deshacer.`,
        tipo: "danger",
        textoAceptar: "Sí, eliminar"
    });

    if (!confirmar) {
        return;
    }

    try {
        await deleteDoc(doc(db, "productos", id));
        mostrarToast("Producto eliminado.", "exito");
    } catch (error) {
        console.error("Error al eliminar en Firestore:", error);
        mostrarToast("No se pudo eliminar el producto. Revisa tu conexión.", "error");
    }
}

// ===============================

function actualizarDashboard() {
    let valor = 0;
    let disponibles = 0;

    productos.forEach((producto) => {
        valor += producto.precio * producto.cantidad;

        if (producto.cantidad > 0) {
            disponibles++;
        }
    });

    totalProductos.textContent = disponibles;
    valorInventario.textContent = "$" + valor.toLocaleString();
}

// ===============================

buscar.addEventListener("input", function () {
    const texto = this.value.toLowerCase().trim();
    const tarjetas = document.querySelectorAll(".producto");

    tarjetas.forEach((tarjeta) => {
        const nombreProd = tarjeta.querySelector("h3").textContent.toLowerCase();

        if (nombreProd.includes(texto)) {
            tarjeta.style.display = "block";
        } else {
            tarjeta.style.display = "none";
        }
    });
});

// ===============================

function cerrarConEscape(e) {
    if (e.key === "Escape") {
        cerrarModal();
    }
}

document.addEventListener("keydown", cerrarConEscape);

// ===============================
// INICIO: nos suscribimos a Firestore. Cada vez que algo cambia
// (agregas, editas o borras un producto, desde cualquier dispositivo),
// esta función se dispara sola y refresca la pantalla.
// ===============================

const q = query(productosRef, orderBy("creado"));

onSnapshot(
    q,
    (snapshot) => {
        productos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        mostrarProductos();
        actualizarDashboard();
        mostrarCatalogo();
        mostrarVenderProductos();
    },
    (error) => {
        console.error("Error al leer Firestore:", error);
        contenedor.innerHTML = `
        <div class="sinProductos">
            <h2>No se pudo conectar a la base de datos</h2>
            <p>Revisa tu conexión a internet o las reglas de Firestore.</p>
        </div>
        `;
    }
);

// ===============================
// VISTA DE CATÁLOGO (pantalla principal)
// ===============================
// Esta es la vista con la que arranca la página: solo se ve la
// moto con su foto, nombre y descripción. El precio, el stock
// exacto y "Registrar venta" se movieron a Ventas > "Registrar
// venta". Aquí en cambio se muestra si la moto ya tiene una
// publicación de Facebook enlazada (verde = tiene enlace,
// rojo = todavía no tiene), con un botón para abrirla.
// ===============================

function mostrarCatalogo() {
    contenedorCatalogo.innerHTML = "";

    if (productos.length === 0) {
        contenedorCatalogo.innerHTML = `
        <div class="sinProductos">
            <h2>No hay motos disponibles todavía</h2>
            <p>Actívalas desde "Modo Inventario" &gt; "Agregar producto".</p>
        </div>
        `;
        return;
    }

    productos.forEach((producto) => {
        const tarjeta = document.createElement("div");
        const tieneFacebook = !!(producto.facebookLink && producto.facebookLink.trim() !== "");

        tarjeta.className = "producto";

        const foto = producto.imagen !== "" ? producto.imagen : SIN_IMAGEN;

        tarjeta.innerHTML = `
        <div class="foto">
            <img src="${foto}">
            <span class="fb-badge ${tieneFacebook ? "" : "inactivo"}">
                <i class="fa-brands fa-facebook"></i>
                ${tieneFacebook ? "Publicado" : "Sin publicar"}
            </span>
        </div>
        <div class="info">
            <h3>${producto.nombre}</h3>
            ${producto.descripcion ? `<p>${producto.descripcion}</p>` : ""}
            ${tieneFacebook ? `
            <div class="botones-catalogo">
                <a class="ver-publicacion" href="${producto.facebookLink}" target="_blank" rel="noopener noreferrer">
                    <i class="fa-brands fa-facebook"></i>
                    Ver publicación
                </a>
            </div>
            ` : ""}
        </div>
        `;

        contenedorCatalogo.appendChild(tarjeta);
    });
}

// ===============================
// REGISTRAR VENTA (dentro de la vista Ventas)
// ===============================
// Muestra las motos disponibles con precio, estado de stock y el
// botón "Registrar venta". Es básicamente lo que antes vivía en la
// pantalla principal, ahora movido a Ventas > "Registrar venta".
// ===============================

function mostrarVenderProductos() {
    contenedorVenderProductos.innerHTML = "";

    if (productos.length === 0) {
        contenedorVenderProductos.innerHTML = `
        <div class="sinProductos">
            <h2>No hay motos disponibles todavía</h2>
            <p>Actívalas desde "Modo Inventario" &gt; "Agregar producto".</p>
        </div>
        `;
        return;
    }

    productos.forEach((producto) => {
        const tarjeta = document.createElement("div");
        const estado = estadoStock(producto.cantidad);
        const agotado = producto.cantidad <= 0;

        tarjeta.className = "producto" + (estado !== "ok" ? " " + estado : "");

        const foto = producto.imagen !== "" ? producto.imagen : SIN_IMAGEN;

        tarjeta.innerHTML = `
        <div class="foto">
            <img src="${foto}">
            <span class="estado ${estado !== "ok" ? estado : ""}">${etiquetaStock(producto.cantidad)}</span>
        </div>
        <div class="info">
            <h3>${producto.nombre}</h3>
            <p class="precio-tag">$${producto.precio.toLocaleString()}</p>
            ${producto.descripcion ? `<p>${producto.descripcion}</p>` : ""}
            <div class="botones-catalogo">
                <button class="vender" ${agotado ? "disabled" : ""}>
                    <i class="fa-solid fa-cash-register"></i>
                    ${agotado ? "Sin stock" : "Registrar venta"}
                </button>
            </div>
        </div>
        `;

        if (!agotado) {
            const btnVender = tarjeta.querySelector(".vender");
            btnVender.onclick = function () {
                registrarVenta(producto.id);
            };
        }

        contenedorVenderProductos.appendChild(tarjeta);
    });
}

// ===============================
// REGISTRO DE VENTAS
// ===============================
// Al presionar "Registrar venta" se crea un documento nuevo en la
// colección "ventas" de Firestore, con fecha, hora, nombre, precio,
// el id del producto vendido y su estado. No modifica el stock del
// producto: eso se deja para una siguiente etapa (filtros/estadísticas).
// ===============================

let vendiendoIds = new Set();

async function registrarVenta(id) {
    const producto = productos.find((p) => p.id === id);
    if (!producto) return;

    // Evita doble clic mientras se está guardando esta misma venta
    if (vendiendoIds.has(id)) {
        return;
    }

    if (producto.cantidad <= 0) {
        mostrarToast("Ya no queda stock de este producto.", "advertencia");
        return;
    }

    const confirmar = await mostrarConfirmacion({
        titulo: "Registrar venta",
        mensaje: `¿Registrar la venta de "${producto.nombre}" por $${producto.precio.toLocaleString()}?`,
        tipo: "primary",
        textoAceptar: "Sí, vender"
    });

    if (!confirmar) {
        return;
    }

    const ahora = new Date();

    // Se genera la referencia de la venta antes de guardar, para poder
    // meterla en el mismo "batch" que el descuento de stock.
    const nuevaVentaRef = doc(ventasRef);

    const venta = {
        productoId: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: 1,
        fecha: ahora.toLocaleDateString(),
        hora: ahora.toLocaleTimeString(),
        estado: "Vendido",
        creado: Date.now()
    };

    vendiendoIds.add(id);

    try {
        // Un solo "batch" para registrar la venta y descontar el stock:
        // o se hacen las dos cosas, o no se hace ninguna.
        const batch = writeBatch(db);
        batch.set(nuevaVentaRef, venta);
        batch.update(doc(db, "productos", producto.id), {
            cantidad: producto.cantidad - 1
        });

        await batch.commit();

        mostrarToast(`Venta de "${producto.nombre}" registrada y descontada del stock.`, "exito");
    } catch (error) {
        console.error("Error al registrar la venta:", error);
        mostrarToast("No se pudo registrar la venta. Revisa tu conexión o las reglas de Firestore.", "error");
    } finally {
        vendiendoIds.delete(id);
    }
}

// ===============================
// HISTORIAL DE VENTAS
// ===============================
// Se suscribe a la colección "ventas" y siempre muestra primero las
// más recientes (orderBy "creado" descendente).
// ===============================

let ventas = [];

// Evita doble clic mientras se está eliminando esta misma venta
let eliminandoVentaIds = new Set();

function mostrarVentas() {
    contenedorVentas.innerHTML = "";

    if (ventas.length === 0) {
        contenedorVentas.innerHTML = `
        <div class="sinProductos">
            <h2>Todavía no hay ventas registradas</h2>
            <p>Cuando registres una venta desde el catálogo, aparecerá aquí.</p>
        </div>
        `;
        return;
    }

    ventas.forEach((venta) => {
        const fila = document.createElement("div");
        fila.className = "venta-item";

        fila.innerHTML = `
        <button class="eliminar-venta" title="Eliminar venta">
            <i class="fa-solid fa-trash"></i>
        </button>
        <div class="venta-info">
            <h3>${venta.nombre}</h3>
            <p class="precio-tag">$${Number(venta.precio).toLocaleString()}</p>
        </div>
        <div class="venta-meta">
            <span><i class="fa-solid fa-calendar"></i> ${venta.fecha}</span>
            <span><i class="fa-solid fa-clock"></i> ${venta.hora || "-"}</span>
            <span class="venta-estado">${venta.estado}</span>
        </div>
        `;

        fila.querySelector(".eliminar-venta").onclick = function () {
            eliminarVenta(venta.id);
        };

        contenedorVentas.appendChild(fila);
    });
}

// ===============================
// ELIMINAR VENTA
// ===============================
// Borra el registro de la venta y, si el producto todavía existe,
// le regresa la cantidad vendida al stock (batch atómico, igual que
// al registrar la venta).
// ===============================

async function eliminarVenta(id) {
    const venta = ventas.find((v) => v.id === id);
    if (!venta) return;

    if (eliminandoVentaIds.has(id)) {
        return;
    }

    const confirmar = await mostrarConfirmacion({
        titulo: "Eliminar venta",
        mensaje: `¿Eliminar la venta de "${venta.nombre}"? Si el producto todavía existe, la cantidad regresará al stock.`,
        tipo: "danger",
        textoAceptar: "Sí, eliminar"
    });

    if (!confirmar) {
        return;
    }

    eliminandoVentaIds.add(id);

    const producto = productos.find((p) => p.id === venta.productoId);

    try {
        const batch = writeBatch(db);
        batch.delete(doc(db, "ventas", id));

        if (producto) {
            batch.update(doc(db, "productos", producto.id), {
                cantidad: producto.cantidad + (venta.cantidad || 1)
            });
        }

        await batch.commit();

        mostrarToast(
            producto
                ? "Venta eliminada. El producto regresó al stock."
                : "Venta eliminada. El producto ya no existe, así que no se ajustó ningún stock.",
            "exito"
        );
    } catch (error) {
        console.error("Error al eliminar la venta:", error);
        mostrarToast("No se pudo eliminar la venta. Revisa tu conexión o las reglas de Firestore.", "error");
    } finally {
        eliminandoVentaIds.delete(id);
    }
}

// ===============================
// ESTADÍSTICAS DEL MES
// ===============================

function actualizarStatsVentas() {
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    let cantidadMes = 0;
    let montoMes = 0;

    ventas.forEach((venta) => {
        const fechaVenta = new Date(venta.creado);

        if (fechaVenta.getMonth() === mesActual && fechaVenta.getFullYear() === anioActual) {
            cantidadMes += venta.cantidad || 1;
            montoMes += Number(venta.precio) * (venta.cantidad || 1);
        }
    });

    if (totalVentasMes) totalVentasMes.textContent = cantidadMes;
    if (montoVentasMes) montoVentasMes.textContent = "$" + montoMes.toLocaleString();
}

const qVentas = query(ventasRef, orderBy("creado", "desc"));

onSnapshot(
    qVentas,
    (snapshot) => {
        ventas = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        mostrarVentas();
        actualizarStatsVentas();
    },
    (error) => {
        console.error("Error al leer el historial de ventas:", error);
        contenedorVentas.innerHTML = `
        <div class="sinProductos">
            <h2>No se pudo cargar el historial de ventas</h2>
            <p>Revisa tu conexión a internet o las reglas de Firestore.</p>
        </div>
        `;
    }
);

// ===============================
// MODO INVENTARIO / VISTA DE CATÁLOGO / VISTA DE VENTAS
// ===============================
// Controla cuál de las tres vistas se muestra. El cambio real de
// interfaz lo hace el CSS a partir de la clase puesta en <body>
// (vista-catalogo / vista-inventario / vista-ventas).
// ===============================

function cambiarVista(vista) {
    document.body.classList.remove("vista-catalogo", "vista-inventario", "vista-ventas");
    document.body.classList.add("vista-" + vista);

    textoModoInventario.textContent =
        vista === "inventario" ? "Volver a catálogo" : "Modo Inventario";
    btnModoInventario.classList.toggle("activo", vista === "inventario");

    [navInicio, navProductos, navVentas].forEach((li) => {
        if (li) li.classList.remove("active");
    });

    if (vista === "catalogo" && navInicio) navInicio.classList.add("active");
    if (vista === "inventario" && navProductos) navProductos.classList.add("active");
    if (vista === "ventas" && navVentas) navVentas.classList.add("active");

    bottomNavItems.forEach((item) => {
        item.classList.toggle("active", item.dataset.vista === vista);
    });

    cerrarMenu();
}

bottomNavItems.forEach((item) => {
    item.onclick = function () {
        cambiarVista(item.dataset.vista);
    };
});

btnModoInventario.onclick = function () {
    const yaEnInventario = document.body.classList.contains("vista-inventario");
    cambiarVista(yaEnInventario ? "catalogo" : "inventario");
};

if (navInicio) {
    navInicio.onclick = function () {
        cambiarVista("catalogo");
    };
}

if (navProductos) {
    navProductos.onclick = function () {
        cambiarVista("inventario");
    };
}

if (navVentas) {
    navVentas.onclick = function () {
        cambiarVista("ventas");
    };
}

// ===============================
// SUB-PESTAÑAS DENTRO DE VENTAS: "Registrar venta" / "Historial de ventas"
// ===============================

function cambiarSubVistaVentas(subvista) {
    const esHistorial = subvista === "historial";

    subVistaRegistrar.classList.toggle("oculto", esHistorial);
    subVistaHistorial.classList.toggle("oculto", !esHistorial);

    tabRegistrarVenta.classList.toggle("activo", !esHistorial);
    tabHistorialVentas.classList.toggle("activo", esHistorial);
}

if (tabRegistrarVenta) {
    tabRegistrarVenta.onclick = function () {
        cambiarSubVistaVentas("registrar");
    };
}

if (tabHistorialVentas) {
    tabHistorialVentas.onclick = function () {
        cambiarSubVistaVentas("historial");
    };
}