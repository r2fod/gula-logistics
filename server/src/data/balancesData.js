// Datos de saldos, bolsas de horas y acuerdos de personal de Gula Logística
export const initialBalancesData = {
  lastUpdated: "14 de Septiembre de 2026",
  workers: [
    {
      id: "johan",
      name: "Johan",
      role: "Conductor & Backup Flota",
      avatar: "🚚",
      status: "A favor",
      statusType: "success",
      currentBalance: 225.00,
      agreements: [
        "Extra a 10,00 € / hora",
        "Liquidación por boda y turnos nocturnos"
      ],
      breakdown: [
        { concept: "Base anterior + Boda Inés", amount: 115.00, isPositive: true },
        { concept: "🕒 12/09 Descarga Chiva (3h de 00:00 a 03:00 a 10€/h)", amount: 30.00, isPositive: true },
        { concept: "🕒 13/09 Domingo (8h de 12:00 a 20:00 a 10€/h)", amount: 80.00, isPositive: true }
      ],
      phone: "",
      notes: "Disponible para refuerzos nocturnos de fin de semana."
    },
    {
      id: "jefferson",
      name: "Jeferson",
      role: "Apoyo Logística & Preparación Base",
      avatar: "📦",
      status: "A favor",
      statusType: "success",
      currentBalance: 330.72,
      isSpecialPurse: true,
      purseInfo: {
        totalHours: 80,
        hourlyRate: 8.75,
        grossBase: 700.00,
        housingDeduction: 200.00,
        netFixedAt80h: 500.00,
        extraRateAfter80h: 10.00,
        consumedHours: 45.5,
        consumedValue: 398.13,
        remainingHoursForExtra: 34.5,
        shifts: [
          { date: "10/09", hours: 10, range: "10:00 a 20:00" },
          { date: "11/09", hours: 15, range: "10:00 a 01:00" },
          { date: "12/09", hours: 13, range: "07:30-18:00 y 23:00-01:30" },
          { date: "13/09", hours: 7.5, range: "06:30-11:30 y 23:00-01:30" }
        ]
      },
      agreements: [
        "Bolsa mensual 80h (700€ base - 200€ alojamiento = 500€ neto)",
        "Horas extra a 10,00 € / hora a partir de las 80h cumplidas"
      ],
      breakdown: [
        { concept: "Valor Acumulado Horas Bolsa (45.5h a 8,75€/h)", amount: 398.13, isPositive: true },
        { concept: "Roturas cristalería eventos", amount: -67.41, isPositive: false }
      ],
      notes: "Una vez completadas las 80h mensuales, las horas adicionales se liquidan como extras a 10€/h."
    },
    {
      id: "ricardo",
      name: "Ricardo",
      role: "Conductor Flota (Veterano)",
      avatar: "🚚",
      status: "Deuda Pendiente",
      statusType: "danger",
      currentBalance: -87.41,
      agreements: [
        "Extra a 10,00 € / hora",
        "Compensación de anticipo acumulado"
      ],
      breakdown: [
        { concept: "Saldo inicial acumulado (03/09)", amount: -285.00, isPositive: false },
        { concept: "🕒 08/09 (17:00 a 19:00 - 2h a 10€/h)", amount: 20.00, isPositive: true },
        { concept: "🕒 09/09 (18:00 a 22:00 - 4h a 10€/h + 25€ gasolina)", amount: 65.00, isPositive: true },
        { concept: "🕒 10/09 (10:00 a 14:00 - 4h a 10€/h)", amount: 40.00, isPositive: true },
        { concept: "🕒 11/09 (12:00 a 17:30 - 5.5h a 10€/h)", amount: 55.00, isPositive: true },
        { concept: "🕒 13/09 (21:00 a 02:00 - 5h a 10€/h)", amount: 50.00, isPositive: true },
        { concept: "🕒 14/09 (09:00 a 12:30 - 3.5h a 10€/h)", amount: 35.00, isPositive: true },
        { concept: "Roturas cristalería eventos", amount: -67.41, isPositive: false }
      ],
      notes: "Saldo ajustado tras descontar horas realizadas contra anticipo inicial."
    },
    {
      id: "gonzalo",
      name: "Gonzalo",
      role: "Conductor Flota (Veterano)",
      avatar: "🚛",
      status: "A favor",
      statusType: "success",
      currentBalance: 122.59,
      agreements: [
        "Extra a 10,00 € / hora",
        "Rutas Albacar & Fincas"
      ],
      breakdown: [
        { concept: "Roturas cristalería eventos", amount: -67.41, isPositive: false },
        { concept: "🕒 11/09 Viernes (7h: 11:30-15:30 y 18:30-21:30)", amount: 70.00, isPositive: true },
        { concept: "🕒 12/09 Sábado (1.5h: 07:00 a 08:30)", amount: 15.00, isPositive: true },
        { concept: "🕒 13/09 Domingo (8h: 12:00 a 20:00)", amount: 80.00, isPositive: true },
        { concept: "🕒 14/09 Lunes (2.5h: 11:00 a 13:30)", amount: 25.00, isPositive: true }
      ],
      notes: "Conductor principal Camión Albacar."
    },
    {
      id: "jaime",
      name: "Jaime",
      role: "Conductor Flota (Guiado)",
      avatar: "🚛",
      status: "Sin saldo",
      statusType: "neutral",
      currentBalance: 0.00,
      agreements: [
        "Extra a 10,00 € / hora",
        "Conductor Flota (Guiado María y Joaquín)"
      ],
      breakdown: [
        { concept: "Aún no hay turnos cerrados de semanas anteriores", amount: 0.00, isPositive: true }
      ],
      notes: "Conductor asignado para refuerzo y guiado en camión 3."
    },
    {
      id: "kerly",
      name: "Kerly",
      role: "Gula Limpieza & Vajilla Eventos",
      avatar: "🧹",
      status: "A favor",
      statusType: "success",
      hasTransportBonus: true,
      transportBonusText: "+10 € transporte / día",
      currentBalance: 235.00,
      agreements: [
        "Extra a 10,00 € / hora",
        "+10,00 € ayuda transporte por día trabajado"
      ],
      breakdown: [
        { concept: "Saldo anterior acumulado", amount: 150.00, isPositive: true },
        { concept: "🕒 13/09 Domingo (7.5h: 08:00 a 15:30 a 10€/h + 10€ transporte)", amount: 85.00, isPositive: true }
      ],
      notes: "Supervisión de limpieza de vajilla e higienización del material de catering."
    },
    {
      id: "jose",
      name: "Jose",
      role: "Gula Limpieza & Apoyo Eventos",
      avatar: "🧹",
      status: "Sin saldo",
      statusType: "neutral",
      hasTransportBonus: true,
      transportBonusText: "+10 € transporte / día",
      currentBalance: 0.00,
      agreements: [
        "Extra a 10,00 € / hora",
        "+10,00 € ayuda transporte por día trabajado"
      ],
      breakdown: [
        { concept: "Aún no hay turnos registrados esta semana", amount: 0.00, isPositive: true }
      ],
      notes: "Incorporación reciente para apoyo de vajilla y logística inversa."
    },
    {
      id: "irene",
      name: "Irene",
      role: "Base & Checklist Pedidos",
      avatar: "📦",
      status: "Nómina (14,00 €/h)",
      statusType: "payroll",
      hourlyRate: 14.00,
      currentBalance: 0.00,
      agreements: [
        "Personal en Nómina Fija",
        "Control interno de horas valoradas a 14,00 € / hora"
      ],
      breakdown: [
        { concept: "Contrato Fijo — Dirección Almacén (Valoración interna: 14,00 €/h)", amount: 0.00, isPositive: true }
      ],
      notes: "Personal en nómina fija. Sus horas se contabilizan y valoran a 14,00 €/h para control presupuestario y de costes internos."
    },
    {
      id: "raul",
      name: "Raúl",
      role: "Jefe de Logística",
      avatar: "📋",
      status: "Nómina (14,00 €/h)",
      statusType: "payroll",
      hourlyRate: 14.00,
      currentBalance: 0.00,
      agreements: [
        "Personal en Nómina Fija",
        "Control interno de horas valoradas a 14,00 € / hora"
      ],
      breakdown: [
        { concept: "Contrato Fijo — Supervisión Logística (Valoración interna: 14,00 €/h)", amount: 0.00, isPositive: true }
      ],
      notes: "Jefe de Logística en nómina fija. Horas valoradas internamente a 14,00 €/h para control financiero."
    }
  ]
};
