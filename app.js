// Importaciones de Firebase SDK (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, push, set, remove, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// Configuración de Firebase (proporcionada por el usuario)
const firebaseConfig = {
  apiKey: "AIzaSyDvBMIMiDuKU97R8Wie-0-T7I_BTrIS-Y8",
  authDomain: "calendario-familia-5aa5a.firebaseapp.com",
  databaseURL: "https://calendario-familia-5aa5a-default-rtdb.firebaseio.com",
  projectId: "calendario-familia-5aa5a",
  storageBucket: "calendario-familia-5aa5a.firebasestorage.app",
  messagingSenderId: "1083605159756",
  appId: "1:1083605159756:web:39edd3af88e3036f3f09e9"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const eventsRef = ref(db, 'events'); // Ruta en la base de datos donde se guardarán las actividades

// Referencias del DOM
const currentDateEl = document.getElementById('currentDate');
const timelineHoursEl = document.getElementById('timelineHours');
const timelineEventsEl = document.getElementById('timelineEvents');
const addBtn = document.getElementById('addBtn');
const eventModal = document.getElementById('eventModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const eventForm = document.getElementById('eventForm');
const modalTitle = document.getElementById('modalTitle');
const deleteBtn = document.getElementById('deleteBtn');
const currTimeLine = document.getElementById('currentTimeLine');

// Configuración visual (debe coincidir con CSS --hour-height)
const HOUR_HEIGHT = 80;

let currentEvents = {}; // Para almacenar los eventos obtenidos de Firebase

// Inicialización de la aplicación
function init() {
    updateDateDisplay();
    generateHourMarkers();
    setupEventListeners();
    fetchEventsRealtime();
    updateCurrentTimeLine();
    
    // Actualizar la línea de tiempo cada minuto
    setInterval(updateCurrentTimeLine, 60000);
}

// Muestra la fecha actual en español
function updateDateDisplay() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    currentDateEl.textContent = today.toLocaleDateString('es-ES', options);
}

// Genera los marcadores de hora (00:00 - 23:00)
function generateHourMarkers() {
    let hoursHtml = '';
    for (let i = 0; i < 24; i++) {
        const hourStr = i.toString().padStart(2, '0') + ':00';
        hoursHtml += `
            <div class="hour-marker">
                <span>${hourStr}</span>
            </div>
        `;
    }
    timelineHoursEl.innerHTML = hoursHtml;
}

// Configura los escuchadores de eventos
function setupEventListeners() {
    addBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', closeModal);
    eventForm.addEventListener('submit', handleFormSubmit);
    deleteBtn.addEventListener('click', handleDeleteEvent);
    
    // Cerrar modal al tocar fuera del contenido
    eventModal.addEventListener('click', (e) => {
        if (e.target === eventModal) closeModal();
    });
}

// === Funciones del Modal ===

// Abrir el modal (sirve para Crear y Editar)
function openModal(eventId = null) {
    eventForm.reset();
    document.getElementById('eventId').value = '';
    
    // Animar la entrada
    eventModal.classList.add('active');
    
    if (eventId && currentEvents[eventId]) {
        // Modo Edición
        modalTitle.textContent = 'Editar Actividad';
        deleteBtn.classList.remove('hidden');
        
        const event = currentEvents[eventId];
        document.getElementById('eventId').value = eventId;
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('startTime').value = event.startTime;
        document.getElementById('endTime').value = event.endTime;
        document.getElementById('eventNotes').value = event.notes || '';
    } else {
        // Modo Creación
        modalTitle.textContent = 'Nueva Actividad';
        deleteBtn.classList.add('hidden');
        
        // Autocompletar con la hora actual y la siguiente
        const now = new Date();
        const startH = now.getHours().toString().padStart(2, '0');
        const startM = now.getMinutes().toString().padStart(2, '0');
        
        const endH = ((now.getHours() + 1) % 24).toString().padStart(2, '0');
        
        document.getElementById('startTime').value = `${startH}:${startM}`;
        document.getElementById('endTime').value = `${endH}:${startM}`;
    }
    
    // Pequeño timeout para enfocar el título en dispositivos que lo soporten
    setTimeout(() => {
        document.getElementById('eventTitle').focus();
    }, 100);
}

// Cerrar el modal
function closeModal() {
    eventModal.classList.remove('active');
    setTimeout(() => {
        eventForm.reset();
    }, 300); // Esperar a que termine la animación
}

// === Operaciones con Firebase ===

// Guardar o Actualizar Evento
function handleFormSubmit(e) {
    e.preventDefault(); // Evitar recarga de página
    
    const eventId = document.getElementById('eventId').value;
    
    const title = document.getElementById('eventTitle').value.trim();
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const notes = document.getElementById('eventNotes').value.trim();
    
    // Validación básica de tiempo
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
        alert("La hora de fin debe ser mayor a la hora de inicio.");
        return;
    }

    const eventData = { title, startTime, endTime, notes };

    // Bloquear el botón mientras guarda
    const submitBtn = eventForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Guardando...';
    submitBtn.disabled = true;

    if (eventId) {
        // Actualizar existente
        update(ref(db, `events/${eventId}`), eventData)
            .then(() => closeModal())
            .catch(error => {
                console.error(error);
                alert("Error al actualizar la actividad.");
            })
            .finally(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
    } else {
        // Crear nuevo (Push genera un ID único automáticamente)
        push(eventsRef, eventData)
            .then(() => closeModal())
            .catch(error => {
                console.error(error);
                alert("Error al guardar la actividad.");
            })
            .finally(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
    }
}

// Eliminar Evento
function handleDeleteEvent() {
    const eventId = document.getElementById('eventId').value;
    if (eventId) {
        if (confirm('¿Estás seguro de que quieres eliminar esta actividad para todos?')) {
            const btn = document.getElementById('deleteBtn');
            btn.textContent = '...';
            btn.disabled = true;
            
            remove(ref(db, `events/${eventId}`))
                .then(() => closeModal())
                .catch(error => alert("Error al eliminar."))
                .finally(() => {
                    btn.textContent = 'Eliminar';
                    btn.disabled = false;
                });
        }
    }
}

// === Lógica de la Interfaz y Sincronización Real-time ===

// Conectar con Firebase y escuchar cambios en tiempo real
function fetchEventsRealtime() {
    // onValue se dispara cada vez que cambian los datos en Firebase
    onValue(eventsRef, (snapshot) => {
        const data = snapshot.val();
        currentEvents = data || {};
        renderEvents();
    }, (error) => {
        console.error("Firebase read failed: " + error.code);
    });
}

// Convierte "HH:MM" a minutos totales (ej "01:30" = 90)
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Dibuja los eventos en el calendario
function renderEvents() {
    // Limpiamos los eventos anteriores
    timelineEventsEl.innerHTML = '';
    
    Object.entries(currentEvents).forEach(([id, event]) => {
        const startMins = timeToMinutes(event.startTime);
        const endMins = timeToMinutes(event.endTime);
        
        // Calcular posicionamiento y tamaño usando position: absolute
        const topPx = (startMins / 60) * HOUR_HEIGHT;
        const heightPx = ((endMins - startMins) / 60) * HOUR_HEIGHT;
        
        const card = document.createElement('div');
        card.className = 'event-card';
        card.style.top = `${topPx}px`;
        card.style.height = `${heightPx}px`;
        
        // Colores consistentes y algo aleatorios basados en el título
        const hue = Array.from(event.title || "A")
            .reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
        
        card.style.borderLeftColor = `hsl(${hue}, 80%, 65%)`;
        card.style.backgroundColor = `hsla(${hue}, 80%, 60%, 0.15)`;
        
        // Si la tarjeta es muy pequeña, ajustamos el layout
        const isSmall = heightPx < 40;
        
        card.innerHTML = `
            <div class="title" style="${isSmall ? 'margin-bottom:0;' : ''}">${event.title}</div>
            ${!isSmall ? `<div class="time"><i class="far fa-clock"></i> ${event.startTime} - ${event.endTime}</div>` : ''}
        `;
        
        // Click para editar
        card.addEventListener('click', () => openModal(id));
        
        timelineEventsEl.appendChild(card);
    });
}

// Actualiza la línea roja indicando la hora actual
function updateCurrentTimeLine() {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    
    // Posición Y
    const topPx = (currentMins / 60) * HOUR_HEIGHT;
    currTimeLine.style.top = `${topPx}px`;
    
    // Si la página recién carga, scrollear para que se vea la hora actual un poco más arriba del centro
    if(!window.initialScrollDone) {
        const container = document.querySelector('.timeline-container');
        // Centrar
        const scrollTo = topPx - (container.clientHeight / 2) + HOUR_HEIGHT;
        container.scrollTop = Math.max(0, scrollTo);
        window.initialScrollDone = true;
    }
}

// Iniciar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);
