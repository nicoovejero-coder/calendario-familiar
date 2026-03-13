import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, push, set, remove, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDvBMIMiDuKU97R8Wie-0-T7I_BTrIS-Y8",
  authDomain: "calendario-familia-5aa5a.firebaseapp.com",
  databaseURL: "https://calendario-familia-5aa5a-default-rtdb.firebaseio.com",
  projectId: "calendario-familia-5aa5a",
  storageBucket: "calendario-familia-5aa5a.firebasestorage.app",
  messagingSenderId: "1083605159756",
  appId: "1:1083605159756:web:39edd3af88e3036f3f09e9"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Estado de la aplicación
let currentDate = new Date(); // Mes y año actual que se está visualizando en el calendario
let selectedDateStr = null;   // Formato YYYY-MM-DD del día al que hicimos clic
let allEventsCache = {};      // Caché de todos los eventos desde Firebase
let unsubscribeEvents = null; // Para limpiar el listener si es necesario

// Constantes visuales
const HOUR_HEIGHT = 80;

// Referencias del DOM - Calendario Principal
const currentMonthDisplay = document.getElementById('currentMonthDisplay');
const calendarGrid = document.getElementById('calendarGrid');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const todayBtn = document.getElementById('todayBtn');

// Referencias del DOM - Day Overlay
const dayOverlay = document.getElementById('dayOverlay');
const closeDayBtn = document.getElementById('closeDayBtn');
const selectedDateDisplay = document.getElementById('selectedDateDisplay');
const timelineHoursEl = document.getElementById('timelineHours');
const timelineEventsEl = document.getElementById('timelineEvents');
const currTimeLine = document.getElementById('currentTimeLine');
const addBtn = document.getElementById('addBtn');

// Referencias del DOM - Modal Formulario
const eventModal = document.getElementById('eventModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const eventForm = document.getElementById('eventForm');
const modalTitle = document.getElementById('modalTitle');
const deleteBtn = document.getElementById('deleteBtn');

// === INICIALIZACIÓN ===
function init() {
    setupEventListeners();
    generateHourMarkers();
    
    // Iniciar renderizado del calendario
    renderCalendar();
    
    // Conectar Firebase
    listenAllEvents();
    
    // Línea de tiempo actual
    setInterval(updateCurrentTimeLine, 60000);
}

// === LÓGICA DEL CALENDARIO MENSUAL ===
function renderCalendar() {
    calendarGrid.innerHTML = '';
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-11
    
    // Formatear Mes y Año para el header
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    currentMonthDisplay.textContent = `${monthNames[month]} ${year}`;
    
    // Calcular días del mes
    const firstDay = new Date(year, month, 1).getDay(); // 0(Dom) a 6(Sab)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Fecha de hoy para resaltarlo
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
    const currentDay = today.getDate();
    
    // Rellenar espacios en blanco antes del primer día del mes
    for (let i = 0; i < firstDay; i++) {
        const emptySlot = document.createElement('div');
        emptySlot.className = 'calendar-day empty';
        calendarGrid.appendChild(emptySlot);
    }
    
    // Generar días
    for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = formatDateStr(year, month, day);
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.dataset.date = dayStr;
        
        if (isCurrentMonth && day === currentDay) {
            dayCell.classList.add('today');
        }
        
        // Verificar si tiene eventos en caché
        if (allEventsCache[dayStr]) {
            dayCell.classList.add('has-events');
        }
        
        dayCell.innerHTML = `<span class="day-num">${day}</span>`;
        dayCell.addEventListener('click', () => openDayOverlay(year, month, day));
        
        calendarGrid.appendChild(dayCell);
    }
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar();
}

function goToToday() {
    currentDate = new Date();
    renderCalendar();
    const todayStr = formatDateStr(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    
    // Si queremos que abrira el día de hoy automáticamente:
    // openDayOverlay(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
}

// Devuelve string YYYY-MM-DD
function formatDateStr(y, m, d) {
    return `${y}-${(m+1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
}

// === LÓGICA DEL DAY OVERLAY ===
function openDayOverlay(year, month, day) {
    selectedDateStr = formatDateStr(year, month, day);
    
    // Configurar texto del header
    const selectedObj = new Date(year, month, day);
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    selectedDateDisplay.textContent = selectedObj.toLocaleDateString('es-ES', options);
    
    // Renderizar los eventos específicos de ESTE día
    renderEventsForSelectedDay();
    
    // Control de la línea de tiempo roja (solo mostrar si es el día de HOY)
    const todayStr = formatDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    if (selectedDateStr === todayStr) {
        currTimeLine.classList.remove('hidden');
        updateCurrentTimeLine();
    } else {
        currTimeLine.classList.add('hidden');
    }
    
    // Animar la entrada
    dayOverlay.classList.add('active');
    
    // Scroll inicial suave
    if (selectedDateStr === todayStr && !window.initialOverlayScrollDone) {
        setTimeout(() => {
            const container = document.querySelector('.timeline-container');
            const now = new Date();
            const currentMins = now.getHours() * 60 + now.getMinutes();
            const topPx = (currentMins / 60) * HOUR_HEIGHT;
            const scrollTo = topPx - (container.clientHeight / 2) + HOUR_HEIGHT;
            container.scrollTop = Math.max(0, scrollTo);
            window.initialOverlayScrollDone = true;
        }, 400); // Esperar que termine la animación
    } else {
        document.querySelector('.timeline-container').scrollTop = 0;
    }
}

function closeDayOverlay() {
    dayOverlay.classList.remove('active');
    selectedDateStr = null;
    window.initialOverlayScrollDone = false; // reset
}

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

// === MOSTRAR EVENTOS EN EL TIMELINE DENTRO DEL DAY OVERLAY ===
function renderEventsForSelectedDay() {
    timelineEventsEl.innerHTML = '';
    
    if (!selectedDateStr) return;
    
    const dayEvents = allEventsCache[selectedDateStr];
    if (!dayEvents) return; // No hay eventos este día
    
    Object.entries(dayEvents).forEach(([id, event]) => {
        const startMins = timeToMinutes(event.startTime);
        const endMins = timeToMinutes(event.endTime);
        
        const topPx = (startMins / 60) * HOUR_HEIGHT;
        const heightPx = ((endMins - startMins) / 60) * HOUR_HEIGHT;
        
        const card = document.createElement('div');
        card.className = 'event-card';
        card.style.top = `${topPx}px`;
        card.style.height = `${heightPx}px`;
        
        // Colores verde esmeralda para coincidir con la temática del calentario
        card.style.borderLeftColor = `#22c55e`; // Green-500
        card.style.backgroundColor = `rgba(34, 197, 94, 0.15)`; // Translucent Green
        
        const isSmall = heightPx < 40;
        
        card.innerHTML = `
            <div class="title" style="${isSmall ? 'margin-bottom:0;' : ''}">${event.title}</div>
            ${!isSmall ? `<div class="time"><i class="far fa-clock"></i> ${event.startTime} - ${event.endTime}</div>` : ''}
        `;
        
        // Editar
        card.addEventListener('click', () => openEventModal(id, event));
        timelineEventsEl.appendChild(card);
    });
}

function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function updateCurrentTimeLine() {
    if (currTimeLine.classList.contains('hidden')) return;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const topPx = (currentMins / 60) * HOUR_HEIGHT;
    currTimeLine.style.top = `${topPx}px`;
}

// === FIREBASE: SINCRONIZACIÓN Y CRUD ===
function listenAllEvents() {
    const eventsRef = ref(db, 'events');
    
    onValue(eventsRef, (snapshot) => {
        const data = snapshot.val();
        // Estructura esperada: events => { "2023-10-31": { id1: {...}, id2: {...} }, "2023-11-01": {...} }
        allEventsCache = data || {};
        
        // Volver a renderizar el calendario (para actualizar las luces verdes)
        renderCalendar();
        
        // Si el DayOverlay está abierto, re-renderizar sus eventos específicos
        if (selectedDateStr && dayOverlay.classList.contains('active')) {
            renderEventsForSelectedDay();
        }
    });
}

// === MODAL FORMULARIO DE EVENTO ===
function openEventModal(eventId = null, eventObj = null) {
    eventForm.reset();
    document.getElementById('eventId').value = eventId || '';
    
    eventModal.classList.add('active');
    
    if (eventId && eventObj) {
        // Modo Editar
        modalTitle.textContent = 'Editar Actividad';
        deleteBtn.classList.remove('hidden');
        
        document.getElementById('eventTitle').value = eventObj.title;
        document.getElementById('startTime').value = eventObj.startTime;
        document.getElementById('endTime').value = eventObj.endTime;
        document.getElementById('eventNotes').value = eventObj.notes || '';
    } else {
        // Modo Crear
        modalTitle.textContent = 'Nueva Actividad';
        deleteBtn.classList.add('hidden');
        
        const now = new Date();
        const startH = now.getHours().toString().padStart(2, '0');
        const startM = now.getMinutes().toString().padStart(2, '0');
        const endH = ((now.getHours() + 1) % 24).toString().padStart(2, '0');
        
        document.getElementById('startTime').value = `${startH}:${startM}`;
        document.getElementById('endTime').value = `${endH}:${startM}`;
    }
    
    setTimeout(() => document.getElementById('eventTitle').focus(), 100);
}

function closeEventModal() {
    eventModal.classList.remove('active');
    setTimeout(() => eventForm.reset(), 300);
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!selectedDateStr) return; // Por seguridad, debemos estar en un día específico
    
    const eventId = document.getElementById('eventId').value;
    const title = document.getElementById('eventTitle').value.trim();
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const notes = document.getElementById('eventNotes').value.trim();
    
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
        alert("La hora de fin debe ser mayor a la hora de inicio.");
        return;
    }

    const eventData = { title, startTime, endTime, notes };
    const submitBtn = eventForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Guardando...';
    submitBtn.disabled = true;

    // Guardar en la ruta específica del día: events/YYYY-MM-DD/id
    if (eventId) {
        update(ref(db, `events/${selectedDateStr}/${eventId}`), eventData)
            .then(() => closeEventModal())
            .catch(e => alert("Error " + e))
            .finally(() => { submitBtn.textContent = originalText; submitBtn.disabled = false; });
    } else {
        push(ref(db, `events/${selectedDateStr}`), eventData)
            .then(() => closeEventModal())
            .catch(e => alert("Error " + e))
            .finally(() => { submitBtn.textContent = originalText; submitBtn.disabled = false; });
    }
}

function handleDeleteEvent() {
    const eventId = document.getElementById('eventId').value;
    if (eventId && selectedDateStr) {
        if (confirm('¿Eliminar actividad para todos?')) {
            const btn = document.getElementById('deleteBtn');
            btn.textContent = '...'; btn.disabled = true;
            
            remove(ref(db, `events/${selectedDateStr}/${eventId}`))
                .then(() => closeEventModal())
                .catch(e => alert("Error"))
                .finally(() => { btn.textContent = 'Eliminar'; btn.disabled = false; });
        }
    }
}

// === EVENT LISTENERS DOM ===
function setupEventListeners() {
    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));
    todayBtn.addEventListener('click', goToToday);
    
    closeDayBtn.addEventListener('click', closeDayOverlay);
    
    addBtn.addEventListener('click', () => openEventModal());
    closeModalBtn.addEventListener('click', closeEventModal);
    eventForm.addEventListener('submit', handleFormSubmit);
    deleteBtn.addEventListener('click', handleDeleteEvent);
    
    eventModal.addEventListener('click', (e) => {
        if (e.target === eventModal) closeEventModal();
    });
}

document.addEventListener('DOMContentLoaded', init);
