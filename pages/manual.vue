<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'console' })

const { t } = useI18n()
useHead({ title: () => `Manual de uso — ${t('common.appName')}` })

const auth = useAuthStore()

type RoleKey = 'admin' | 'especialista' | 'cliente'

const currentRoleKey = computed<RoleKey>(() => {
  if (auth.isAdmin) return 'admin'
  if (auth.isEspecialista) return 'especialista'
  return 'cliente'
})

interface Step {
  title: string
  body: string
  link?: { to: string; label: string }
}
interface ManualSection {
  key: RoleKey
  icon: string
  label: string
  intro: string
  rol: string
  pasos: Step[]
  tips?: string[]
}

const allSections: ManualSection[] = [
  {
    key: 'admin',
    icon: 'mdi-shield-crown-outline',
    label: 'Administrador',
    intro: 'Tu cuenta tiene acceso total al portal. Gestionas catálogos, usuarios, compañías y la bandeja completa de solicitudes públicas.',
    rol: 'Mantienes el sistema operativo. Recibes los intakes anónimos, los conviertes en clientes reales y supervisas todo el ciclo de QA. También resuelves casos en los que ningún especialista tomó una solicitud o cuando hay que aceptar manualmente.',
    pasos: [
      {
        title: '1. Configura los catálogos base',
        body: 'Antes de operar, asegúrate de que existen países, tipos de QA y ambientes. Sin tipos de QA el wizard público no puede mostrar opciones al cliente.',
        link: { to: '/admin/test-types', label: 'Ir a tipos de prueba' }
      },
      {
        title: '2. Crea especialistas',
        body: 'Crea los usuarios con rol ROLE_ESPECIALISTA. Ellos van a tomar las solicitudes y armar los presupuestos. No hay registro público para ningún rol.',
        link: { to: '/admin/companias', label: 'Ir a usuarios y compañías' }
      },
      {
        title: '3. Revisa la bandeja de solicitudes',
        body: 'Cada vez que alguien envía el wizard público (/solicitar) aparece una nueva Submission en estado PENDING. Léela y decide si pides aclaraciones o pasas directo a presupuestar.',
        link: { to: '/admin/submissions', label: 'Abrir bandeja' }
      },
      {
        title: '4. Toma o asigna la solicitud',
        body: 'Usa "Tomar / Asignarme" si vas a manejarla tú; si no, deja que un especialista la tome desde su panel. El especialista asignado recibirá las notificaciones del cliente.'
      },
      {
        title: '5. Construye el presupuesto',
        body: 'Edita el alcance (módulos / funcionalidades) que el cliente dejó y agrega los que falten. Luego convierte cada feature en un item de presupuesto (botón "→ presupuesto" por fila, o "Pasar todo al presupuesto" en bulk). Ajusta días y tarifa cuando sea necesario.'
      },
      {
        title: '6. Publica el presupuesto al cliente',
        body: 'Presiona "Marcar como presupuestada". El sistema enviará al cliente el correo "tu presupuesto está listo" con el link privado /solicitud/{token} y la submission pasa a BUDGETED.'
      },
      {
        title: '7. Acompaña la negociación',
        body: 'El cliente puede sumar/quitar features y comentar desde su link público. Cualquier cambio devuelve la solicitud a NEGOTIATING e invalida los acuerdos. Responde sus comentarios desde el detalle del admin.'
      },
      {
        title: '8. Marca el acuerdo interno',
        body: 'Cuando el presupuesto te parece definitivo, presiona "Marcar acuerdo interno". Si el cliente también aprobó, la submission pasa a AGREED → AWAITING_PAYMENT y se le pide confirmar el pago.'
      },
      {
        title: '9. Confirmación de pago y arranque',
        body: 'El cliente confirma el pago desde su link privado. Eso dispara la auto-provisión: compañía, proyecto, usuario cliente, TestRequest y Quote. La solicitud queda ACCEPTED. Si necesitas marcarlo manualmente, usa el botón "Aceptar (manual)" como fallback de admin.'
      },
      {
        title: '10. Supervisa la operación',
        body: 'Desde /dashboard ves los KPIs globales. Cualquier solicitud activa la sigues en /requests; los hallazgos del kanban quedan trazados al feature y al proyecto.',
        link: { to: '/dashboard', label: 'Ir al dashboard' }
      }
    ],
    tips: [
      'Si una URL fue compartida con un cliente y la perdió, puedes reenviarla copiándola desde el detalle del admin.',
      'Cuando un cliente pide ajustes (client-reject), la solicitud vuelve a AWAITING_CLARIFICATION; revisa el hilo de comentarios para entender qué quiere cambiar.',
      'El escáner del sitio (botón "Escanear ahora" en el detalle) corre bajo demanda; úsalo para tener un punto de partida del alcance.'
    ]
  },
  {
    key: 'especialista',
    icon: 'mdi-account-hard-hat-outline',
    label: 'Especialista QA',
    intro: 'Eres quien ejecuta el trabajo de QA. Tomas solicitudes desde la bandeja, defines alcance y presupuesto, ejecutas las pruebas y registras los hallazgos.',
    rol: 'Manejas todo el ciclo operativo de las solicitudes que tomas: relevamiento, cotización, ejecución y reporte. Eres el principal interlocutor con el cliente durante la negociación y mientras se ejecuta el QA.',
    pasos: [
      {
        title: '1. Toma una solicitud',
        body: 'En la bandeja del admin verás las submissions abiertas. Presiona "Tomar / Asignarme" en la que quieras manejar para que quede asignada a ti.',
        link: { to: '/admin/submissions', label: 'Abrir bandeja' }
      },
      {
        title: '2. Revisa el alcance declarado',
        body: 'Lee la descripción del QA, el sitio web (si lo dejaron) y las funcionalidades preliminares. Comenta desde el detalle si necesitas más información antes de presupuestar.'
      },
      {
        title: '3. Completa el alcance',
        body: 'Agrega los módulos y funcionalidades que falten. Si el cliente dejó una URL, usa "Escanear ahora" para detectar funcionalidades automáticamente como punto de partida.'
      },
      {
        title: '4. Genera los items de presupuesto',
        body: 'Convierte el scope en items de presupuesto. Cada feature puede pasar a un item "Ejecución" con un día estimado; ajusta días y tarifa después. Tu tarifa por hora se aplica automáticamente si no llenas el campo.'
      },
      {
        title: '5. Marca como presupuestada',
        body: 'Cuando esté listo, presiona "Marcar como presupuestada". El cliente recibirá el correo con el link privado para revisar el presupuesto, comentar y aprobar.'
      },
      {
        title: '6. Negocia con el cliente',
        body: 'El cliente puede agregar/quitar funcionalidades y dejar comentarios desde su link público. Responde sus comentarios desde el detalle del admin; tu respuesta queda como "Equipo MBP" en el hilo.'
      },
      {
        title: '7. Cierra el acuerdo',
        body: 'Cuando el presupuesto te conforma, presiona "Marcar acuerdo interno". Si el cliente también firmó, la solicitud pasará a esperar el pago.'
      },
      {
        title: '8. Ejecuta el QA en el kanban',
        body: 'Cuando el cliente confirme el pago, se crea automáticamente el TestRequest. Lo encuentras en /requests y entras a su tablero kanban. Mueve las tarjetas BACKLOG → IN_PROGRESS → DONE a medida que avanzas.',
        link: { to: '/requests', label: 'Ir a mis solicitudes' }
      },
      {
        title: '9. Levanta hallazgos (Fixes)',
        body: 'En cada tarjeta puedes crear Fixes que documenten los problemas encontrados. Quedan asociados a la funcionalidad, al proyecto y al cliente que los reportó.'
      },
      {
        title: '10. Comunica el avance',
        body: 'Comenta dentro de cada fix o tarjeta para mantener al cliente informado. El cliente recibirá notificaciones in-app cuando levantes un hallazgo o cambies su estado.'
      }
    ],
    tips: [
      'Las solicitudes asignadas a ti aparecen en /requests aunque no seas miembro de la compañía del cliente.',
      'Si un fix queda en duda, déjalo en IN_REVIEW: el cliente puede comentarlo y luego decides si lo resuelves o lo marcas WONT_FIX.',
      'Mantén tu tarifa por hora actualizada en tu perfil; se usará como default al agregar items de presupuesto.'
    ]
  },
  {
    key: 'cliente',
    icon: 'mdi-office-building-outline',
    label: 'Usuario cuenta compañía',
    intro: 'Eres el punto de contacto de tu compañía con el equipo MBP Testing. Desde aquí ves el avance de cada QA solicitado, los hallazgos encontrados y puedes comunicarte con el especialista asignado.',
    rol: 'Acompañas el QA: revisas el presupuesto, apruebas, pagas y luego sigues el avance del trabajo en tiempo real. Puedes comentar dudas, ver los hallazgos y validar lo entregado.',
    pasos: [
      {
        title: '1. Recibes el link privado',
        body: 'Cuando alguien de tu empresa envió la solicitud desde /solicitar, te llegó (o le llegó al email indicado) un correo con un link privado /solicitud/{token} para hacer seguimiento sin necesidad de cuenta.'
      },
      {
        title: '2. Revisa el presupuesto',
        body: 'Cuando el equipo MBP termine de armarlo, recibes el correo "tu presupuesto está listo". Entra al link y revisa los items, las horas y el total.'
      },
      {
        title: '3. Ajusta el alcance si lo necesitas',
        body: 'Desde el link público puedes sumar o quitar funcionalidades y dejar comentarios. Cada cambio nos avisa para revisar el presupuesto.'
      },
      {
        title: '4. Aprueba o pide cambios',
        body: 'Si el presupuesto te conforma, presiona "Aprobar presupuesto". Si no, "Pedir ajustes" con el motivo y el equipo lo ajustará.'
      },
      {
        title: '5. Confirma el pago',
        body: 'Cuando ambos aprobemos el presupuesto, te enviamos el correo "confirma tu pago". Desde el mismo link privado registras la referencia de pago. Esto inicia el QA y te creamos tu cuenta en el portal.'
      },
      {
        title: '6. Inicia sesión',
        body: 'Recibirás un correo con tus credenciales temporales (email y contraseña). Inicia sesión en /login y cambia la contraseña al ingresar.',
        link: { to: '/login', label: 'Ir al login' }
      },
      {
        title: '7. Sigue tus solicitudes',
        body: 'En /requests verás todas las solicitudes de tu compañía. Abre el detalle para ver el estado, el presupuesto aprobado y el avance.',
        link: { to: '/requests', label: 'Ir a mis solicitudes' }
      },
      {
        title: '8. Mira el tablero kanban',
        body: 'Cada solicitud tiene su tablero con las funcionalidades en BACKLOG, IN_PROGRESS y DONE. Es el reflejo en vivo de lo que está haciendo el especialista.'
      },
      {
        title: '9. Revisa los hallazgos',
        body: 'Por cada funcionalidad pueden levantarse Fixes (hallazgos). Lee la descripción, comenta dudas y marca lo que ya validaste.'
      },
      {
        title: '10. Comunícate con el especialista',
        body: 'Puedes comentar en cualquier fix o tarjeta. El especialista asignado y el equipo MBP reciben tu mensaje al instante.'
      }
    ],
    tips: [
      'El link privado /solicitud/{token} sigue funcionando incluso después de tener tu cuenta: úsalo si quieres consultar la negociación inicial.',
      'Si pierdes la contraseña, contacta al administrador del portal: hoy no hay reset automático.',
      'Si necesitas que varios usuarios de tu empresa accedan, pídele al administrador del portal que los cree y los asocie a tu compañía.'
    ]
  }
]

const section = computed<ManualSection>(() =>
  allSections.find(s => s.key === currentRoleKey.value) ?? allSections[2]
)
</script>

<template>
  <v-container class="py-8" max-width="1200">
    <div class="d-flex align-center ga-3 mb-4">
      <v-icon size="32" color="primary">mdi-book-open-page-variant-outline</v-icon>
      <div>
        <div class="text-overline text-medium-emphasis">Ayuda</div>
        <h1 class="text-h4 mb-0">Manual de uso</h1>
      </div>
    </div>
    <p class="text-body-2 text-medium-emphasis mb-6" style="max-width: 720px;">
      Esta guía resume qué hace tu rol en el portal y los pasos para completar el flujo de QA. Si tu cuenta tiene más de un rol, te mostramos el de mayor responsabilidad.
    </p>

    <v-card variant="outlined" class="pa-6">
      <div class="d-flex align-center ga-3 mb-3 flex-wrap">
        <v-icon size="28" color="primary">{{ section.icon }}</v-icon>
        <h2 class="text-h5 mb-0">{{ section.label }}</h2>
        <v-chip size="small" color="primary" variant="tonal" class="ms-2">Tu rol</v-chip>
      </div>
      <p class="text-body-1 mb-5" style="max-width: 800px;">{{ section.intro }}</p>

      <v-card variant="tonal" color="primary" class="mb-6">
        <v-card-text>
          <div class="text-overline mb-1">Tu rol</div>
          <div class="text-body-2">{{ section.rol }}</div>
        </v-card-text>
      </v-card>

      <div class="text-overline mb-3">Pasos para completarlo</div>

      <v-timeline side="end" align="start" density="compact" class="mb-6 manual-timeline">
        <v-timeline-item
          v-for="(p, i) in section.pasos"
          :key="i"
          size="small"
          dot-color="primary"
          fill-dot
        >
          <template #icon>
            <span class="text-caption font-weight-bold">{{ i + 1 }}</span>
          </template>
          <div class="text-subtitle-2 mb-1">{{ p.title }}</div>
          <div class="text-body-2 text-medium-emphasis" style="max-width: 760px;">{{ p.body }}</div>
          <v-btn
            v-if="p.link"
            :to="p.link.to"
            size="x-small"
            variant="text"
            color="primary"
            class="mt-1"
            append-icon="mdi-arrow-right"
          >
            {{ p.link.label }}
          </v-btn>
        </v-timeline-item>
      </v-timeline>

      <template v-if="section.tips && section.tips.length">
        <v-divider class="my-4" />
        <div class="text-overline mb-2">Consejos rápidos</div>
        <div class="d-flex flex-column ga-2">
          <div v-for="(tip, i) in section.tips" :key="i" class="d-flex ga-2">
            <v-icon size="18" color="accent" class="mt-1">mdi-lightbulb-on-outline</v-icon>
            <div class="text-body-2 text-medium-emphasis">{{ tip }}</div>
          </div>
        </div>
      </template>
    </v-card>
  </v-container>
</template>

<style scoped>
.manual-timeline :deep(.v-timeline-item__body) {
  padding-block: 4px 16px;
}
</style>
