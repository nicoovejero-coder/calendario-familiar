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
let lastNotificationDate = null; // Para evitar múltiples notificaciones el mismo día

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

// Referencias del DOM - Main FAB y Summary
const mainAddBtn = document.getElementById('mainAddBtn');
const summaryList = document.getElementById('summaryList');

// Referencias del DOM - Modal Formulario
const eventModal = document.getElementById('eventModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const eventForm = document.getElementById('eventForm');
const modalTitle = document.getElementById('modalTitle');
const deleteBtn = document.getElementById('deleteBtn');
const dateInputGroup = document.getElementById('dateInputGroup');
const eventDateInput = document.getElementById('eventDate');
const testNotifyBtn = document.getElementById('testNotifyBtn');

// === INICIALIZACIÓN ===
function init() {
    setupEventListeners();
    generateHourMarkers();
    
    // Iniciar renderizado del calendario
    renderCalendar();
    
    // Conectar Firebase
    listenAllEvents();
    
    // Solicitar permiso de notificaciones
    if ("Notification" in window) {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }
    
    // Iniciar chequeo de notificaciones cada minuto
    setInterval(checkDailyNotifications, 60000);
    
    // Línea de tiempo actual
    setInterval(updateCurrentTimeLine, 60000);
}

function checkDailyNotifications() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    
    const now = new Date();
    const todayStr = formatDateStr(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Si ya pasaron las 06:00 y no hemos notificado hoy, disparar
    if (now.getHours() >= 6 && lastNotificationDate !== todayStr) {
        const eventsToday = allEventsCache[todayStr];
        
        if (eventsToday) {
            const count = Object.keys(eventsToday).length;
            const message = count === 1 
                ? "Tienes 1 actividad programada para hoy." 
                : `Tienes ${count} actividades programadas para hoy.`;
                
            new Notification("Cronograma Familiar", {
                body: message,
                icon: "https://cdn-icons-png.flaticon.com/512/3652/3652191.png" // Icono de calendario genérico
            });
        }
        lastNotificationDate = todayStr;
    }
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
    
    // Actualizar también el resumen mensual
    renderMonthlySummary();
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
    mainAddBtn.classList.add('hidden'); // Ocultar el botón general
    
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
    mainAddBtn.classList.remove('hidden'); // Mostrar el botón general de nuevo
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
        card.addEventListener('click', () => {
            // Inform the modal that this is context-specific to the day view
            openEventModal(id, event, false); 
        });
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

// === RESUMEN MENSUAL ===
function renderMonthlySummary() {
    summaryList.innerHTML = '';
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-11
    
    // Recopilar todos los eventos de este mes
    const eventsThisMonth = [];
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for(let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatDateStr(year, month, day);
        if(allEventsCache[dateStr]) {
            Object.entries(allEventsCache[dateStr]).forEach(([id, event]) => {
                eventsThisMonth.push({
                    id,
                    dateStr,
                    dayNum: day,
                    ...event
                });
            });
        }
    }
    
    if (eventsThisMonth.length === 0) {
        summaryList.innerHTML = '<div class="empty-summary">No hay actividades registradas en este mes.</div>';
        return;
    }
    
    // Ordenar cronológicamente (por día y luego por hora)
    eventsThisMonth.sort((a, b) => {
        if (a.dayNum !== b.dayNum) return a.dayNum - b.dayNum;
        return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
    
    // Renderizar
    eventsThisMonth.forEach(ev => {
        const item = document.createElement('div');
        item.className = 'summary-item';
        
        // Calcular nombre del día corto
        const dateObj = new Date(year, month, ev.dayNum);
        const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'short' });
        
        item.innerHTML = `
            <div class="item-title">${ev.title}</div>
            <div class="item-meta">
                <span><i class="far fa-calendar"></i> ${dayName} ${ev.dayNum}</span>
                <span><i class="far fa-clock"></i> ${ev.startTime} - ${ev.endTime}</span>
            </div>
        `;
        
        // Al hacer clic, abre el modal en modo Solo Lectura
        item.addEventListener('click', () => {
             openEventModal(ev.id, ev, true, ev.dateStr, true); 
        });
        
        summaryList.appendChild(item);
    });
}

// === FIREBASE: SINCRONIZACIÓN Y CRUD ===
function listenAllEvents() {
    const eventsRef = ref(db, 'events');
    
    onValue(eventsRef, (snapshot) => {
        const data = snapshot.val();
        // Estructura esperada: events => { "2023-10-31": { id1: {...}, id2: {...} }, "2023-11-01": {...} }
        allEventsCache = data || {};
        
        // Volver a renderizar el calendario (para actualizar las luces verdes y el resumen)
        renderCalendar();
        
        // Si el DayOverlay está abierto, re-renderizar sus eventos específicos
        if (selectedDateStr && dayOverlay.classList.contains('active')) {
            renderEventsForSelectedDay();
        }
    });
}

// === MODAL FORMULARIO DE EVENTO ===
// showDateSelector determina si el input de fecha está visible.
// targetDate es opcional (se usa para edicion desde el resumen de mes)
// isReadOnly determina si el modal permite o no cambios
function openEventModal(eventId = null, eventObj = null, showDateSelector = false, targetDate = null, isReadOnly = false) {
    eventForm.reset();
    document.getElementById('eventId').value = eventId || '';
    
    // Configurar visibilidad del campo fecha
    if (showDateSelector) {
        dateInputGroup.style.display = 'block';
        if(!targetDate && !eventId) {
            const now = new Date();
            eventDateInput.value = formatDateStr(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (targetDate) {
            eventDateInput.value = targetDate;
        }
    } else {
        dateInputGroup.style.display = 'none';
        targetDate = selectedDateStr;
        eventDateInput.value = targetDate;
    }
    
    // Configurar si es Solo Lectura
    const formInputs = eventForm.querySelectorAll('input, textarea');
    const submitBtn = eventForm.querySelector('button[type="submit"]');
    
    if (isReadOnly) {
        modalTitle.textContent = 'Detalles de Actividad';
        formInputs.forEach(input => input.readOnly = true);
        submitBtn.classList.add('hidden');
        deleteBtn.classList.add('hidden');
    } else {
        formInputs.forEach(input => input.readOnly = false);
        submitBtn.classList.remove('hidden');
        // El deleteBtn se maneja abajo dependiendo de si es edicion/creacion
    }

    eventModal.classList.add('active');
    
    if (eventId && eventObj) {
        // Modo Editar o Detalle
        if (!isReadOnly) {
            modalTitle.textContent = 'Editar Actividad';
            deleteBtn.classList.remove('hidden');
        }
        
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
    
    if (!isReadOnly) {
        setTimeout(() => document.getElementById('eventTitle').focus(), 100);
    }
}

function closeEventModal() {
    eventModal.classList.remove('active');
    setTimeout(() => eventForm.reset(), 300);
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    const eventId = document.getElementById('eventId').value;
    const title = document.getElementById('eventTitle').value.trim();
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const notes = document.getElementById('eventNotes').value.trim();
    
    // Forzar que el valor sea YYYY-MM-DD (algunos navegadores pueden variar)
    const targetDate = eventDateInput.value;
    
    if(!targetDate || targetDate === "") {
        alert("Por favor selecciona una fecha válida.");
        return;
    }
    
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
        alert("La hora de fin debe ser mayor a la hora de inicio (Formato 24hs).");
        return;
    }

    const eventData = { title, startTime, endTime, notes };
    const submitBtn = eventForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Guardando...';
    submitBtn.disabled = true;

    const onSuccess = () => {
        closeEventModal();
        // Feedback visual de éxito
        console.log("Evento guardado con éxito en:", targetDate);
    };

    const onError = (error) => {
        alert("No se pudo guardar: " + error.message);
        console.error("Firebase Error:", error);
    };

    if (eventId) {
        update(ref(db, `events/${targetDate}/${eventId}`), eventData)
            .then(onSuccess)
            .catch(onError)
            .finally(() => { submitBtn.textContent = originalText; submitBtn.disabled = false; });
    } else {
        push(ref(db, `events/${targetDate}`), eventData)
            .then(onSuccess)
            .catch(onError)
            .finally(() => { submitBtn.textContent = originalText; submitBtn.disabled = false; });
    }
}

function handleDeleteEvent() {
    const eventId = document.getElementById('eventId').value;
    const targetDate = eventDateInput.value; // Necesitamos saber en qué fecha estaba guardado
    
    if (eventId && targetDate) {
        if (confirm('¿Eliminar actividad para todos?')) {
            const btn = document.getElementById('deleteBtn');
            btn.textContent = '...'; btn.disabled = true;
            
            remove(ref(db, `events/${targetDate}/${eventId}`))
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
    
    // Add desde el DayOverlay oculta el date input
    addBtn.addEventListener('click', () => openEventModal(null, null, false));
    
    // Add desde el panel principal MUESTRA el date input
    mainAddBtn.addEventListener('click', () => {
        console.log("Main Add button clicked");
        openEventModal(null, null, true);
    });
    
    closeModalBtn.addEventListener('click', closeEventModal);
    eventForm.addEventListener('submit', handleFormSubmit);
    deleteBtn.addEventListener('click', handleDeleteEvent);
    
    eventModal.addEventListener('click', (e) => {
        if (e.target === eventModal) closeEventModal();
    });

    testNotifyBtn.addEventListener('click', () => {
        if (!("Notification" in window)) {
            alert("Tu navegador no soporta notificaciones.");
            return;
        }

        if (Notification.permission !== "granted") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") sendTestNotification();
            });
        } else {
            sendTestNotification();
        }
    });
}

function sendTestNotification() {
    new Notification("Prueba de Cronograma", {
        body: "¡Esto es una prueba! Así recibirás los avisos cada mañana a las 06:00 AM.",
        icon: "https://cdn-icons-png.flaticon.com/512/3652/3652191.png"
    });
}

document.addEventListener('DOMContentLoaded', init);
