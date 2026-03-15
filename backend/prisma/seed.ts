import { PrismaClient, UserRole, TicketStatus, Priority } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── TENANT DEMO ─────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-company' },
    update: {},
    create: {
      name: 'Demo Company',
      slug: 'demo-company',
      plan: 'pro',
      settings: {
        timezone: 'Europe/Rome',
        language: 'it',
        ticketPrefix: 'DEMO',
      },
    },
  });
  console.log(`✅ Tenant: ${tenant.name}`);

  // ─── TENANT COUNTER ───────────────────────────────────────────────────────
  await prisma.tenantCounter.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id, ticketCounter: 0 },
  });

  // ─── USERS ────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@demo.com',
      passwordHash,
      name: 'Admin Demo',
      role: UserRole.ADMIN,
    },
  });

  const agent1 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'marco.bianchi@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'marco.bianchi@demo.com',
      passwordHash,
      name: 'Marco Bianchi',
      role: UserRole.AGENT,
    },
  });

  const agent2 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'sara.verdi@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'sara.verdi@demo.com',
      passwordHash,
      name: 'Sara Verdi',
      role: UserRole.AGENT,
    },
  });

  const agent3 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'luca.rossi@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'luca.rossi@demo.com',
      passwordHash,
      name: 'Luca Rossi',
      role: UserRole.AGENT,
    },
  });

  const viewer = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'viewer@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'viewer@demo.com',
      passwordHash,
      name: 'Viewer Demo',
      role: UserRole.VIEWER,
    },
  });

  console.log(`✅ Users: admin, 3 agents, 1 viewer`);

  // ─── SLA PROFILES ─────────────────────────────────────────────────────────
  const slaData = [
    { priority: Priority.URGENT, firstResponseHours: 1, resolutionHours: 4, name: 'Urgente' },
    { priority: Priority.HIGH, firstResponseHours: 2, resolutionHours: 8, name: 'Alto' },
    { priority: Priority.MEDIUM, firstResponseHours: 8, resolutionHours: 24, name: 'Medio' },
    { priority: Priority.LOW, firstResponseHours: 24, resolutionHours: 72, name: 'Basso' },
  ];

  for (const sla of slaData) {
    await prisma.slaProfile.upsert({
      where: { tenantId_priority: { tenantId: tenant.id, priority: sla.priority } },
      update: {},
      create: { tenantId: tenant.id, ...sla },
    });
  }
  console.log(`✅ SLA Profiles: 4 priority levels`);

  // ─── CUSTOM FIELD DEFINITIONS ─────────────────────────────────────────────
  const fields = [
    { fieldName: 'product_version', fieldType: 'text', label: 'Versione Prodotto', order: 1 },
    { fieldName: 'category', fieldType: 'select', label: 'Categoria', order: 2, options: [
      { value: 'bug', label: 'Bug' },
      { value: 'feature', label: 'Feature Request' },
      { value: 'billing', label: 'Fatturazione' },
      { value: 'general', label: 'Generale' },
    ]},
    { fieldName: 'affected_users', fieldType: 'number', label: 'Utenti Coinvolti', order: 3 },
  ];

  for (const field of fields) {
    await prisma.ticketFieldDefinition.upsert({
      where: { tenantId_fieldName: { tenantId: tenant.id, fieldName: field.fieldName } },
      update: {},
      create: { tenantId: tenant.id, ...field },
    });
  }
  console.log(`✅ Custom fields: 3 definitions`);

  // ─── SAMPLE TICKETS ───────────────────────────────────────────────────────
  const customers = [
    { name: 'Alice Fontana', email: 'alice.fontana@customer.com', phone: '+39 347 1234567' },
    { name: 'Roberto Esposito', email: 'roberto.e@acme.it', phone: '+39 333 9876543' },
    { name: 'Claudia Marino', email: 'claudia.marino@bigcorp.com', phone: '+39 320 5551234' },
    { name: 'Davide Colombo', email: 'davide.c@startup.io', phone: null },
    { name: 'Elena Ricci', email: 'elena.ricci@example.org', phone: '+39 328 7654321' },
  ];

  const ticketTemplates = [
    {
      title: 'Impossibile accedere al pannello di controllo',
      description: 'Dal mattino non riesco più ad accedere. Il sistema restituisce errore 403 dopo il login.',
      status: TicketStatus.OPEN,
      priority: Priority.HIGH,
      customerIdx: 0,
      assigneeId: agent1.id,
      tags: ['accesso', 'pannello'],
    },
    {
      title: 'Fattura di dicembre non ricevuta',
      description: 'Non ho ricevuto la fattura relativa al mese di dicembre. Pagamento già effettuato.',
      status: TicketStatus.IN_PROGRESS,
      priority: Priority.MEDIUM,
      customerIdx: 1,
      assigneeId: agent2.id,
      tags: ['fatturazione'],
    },
    {
      title: 'Bug critico: dati utente corrotti dopo aggiornamento',
      description: 'Dopo l\'aggiornamento alla v2.3.1 alcuni record utente risultano corrotti. Impatta circa 50 utenti.',
      status: TicketStatus.OPEN,
      priority: Priority.URGENT,
      customerIdx: 2,
      assigneeId: agent1.id,
      tags: ['bug', 'critico', 'dati'],
    },
    {
      title: 'Richiesta funzionalità: export in formato Excel',
      description: 'Sarebbe molto utile poter esportare i report direttamente in formato Excel (.xlsx).',
      status: TicketStatus.OPEN,
      priority: Priority.LOW,
      customerIdx: 3,
      assigneeId: null,
      tags: ['feature-request', 'export'],
    },
    {
      title: 'Performance degradata nelle ore di punta',
      description: 'Tra le 9 e le 11 il sistema è molto lento. I caricamenti impiegano anche 10-15 secondi.',
      status: TicketStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      customerIdx: 4,
      assigneeId: agent3.id,
      tags: ['performance'],
    },
    {
      title: 'Integrazione API non funzionante',
      description: 'L\'endpoint /api/v1/sync non risponde più dalla settimana scorsa. Il webhook non riceve dati.',
      status: TicketStatus.PENDING_CUSTOMER,
      priority: Priority.HIGH,
      customerIdx: 0,
      assigneeId: agent2.id,
      tags: ['api', 'integrazione'],
    },
    {
      title: 'Richiesta modifica dati anagrafica',
      description: 'Ho bisogno di aggiornare la ragione sociale della mia azienda nei vostri sistemi.',
      status: TicketStatus.RESOLVED,
      priority: Priority.LOW,
      customerIdx: 1,
      assigneeId: agent3.id,
      tags: ['anagrafica'],
    },
    {
      title: 'Errore nel calcolo della fattura pro-rata',
      description: 'La fattura di questo mese riporta un importo errato. Ho attivato il piano il giorno 15 ma fatturano il mese intero.',
      status: TicketStatus.RESOLVED,
      priority: Priority.MEDIUM,
      customerIdx: 2,
      assigneeId: agent1.id,
      tags: ['fatturazione', 'bug'],
    },
    {
      title: 'Domanda su limiti del piano Basic',
      description: 'Quante API call sono incluse nel piano Basic? Non trovo questa info nella documentazione.',
      status: TicketStatus.CLOSED,
      priority: Priority.LOW,
      customerIdx: 3,
      assigneeId: agent2.id,
      tags: ['piani', 'api'],
    },
    {
      title: 'Richiesta upgrade piano',
      description: 'Vorrei passare dal piano Basic al piano Pro. Come si procede?',
      status: TicketStatus.CLOSED,
      priority: Priority.LOW,
      customerIdx: 4,
      assigneeId: agent3.id,
      tags: ['piani', 'upgrade'],
    },
  ];

  // Get or create counter
  let counter = await prisma.tenantCounter.findUnique({ where: { tenantId: tenant.id } });

  for (const tmpl of ticketTemplates) {
    const { customerIdx, assigneeId, ...rest } = tmpl;
    const customer = customers[customerIdx];

    await prisma.$transaction(async (tx) => {
      const cnt = await tx.tenantCounter.update({
        where: { tenantId: tenant.id },
        data: { ticketCounter: { increment: 1 } },
      });

      const ticket = await tx.ticket.create({
        data: {
          tenantId: tenant.id,
          number: cnt.ticketCounter,
          createdById: admin.id,
          assigneeId,
          customerEmail: customer.email,
          customerName: customer.name,
          customerPhone: customer.phone,
          slaBreachAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          ...rest,
        },
      });

      // Add initial message
      await tx.message.create({
        data: {
          tenantId: tenant.id,
          ticketId: ticket.id,
          authorType: 'customer',
          content: rest.description,
        },
      });

      // Add agent reply if not open/unassigned
      if (assigneeId && rest.status !== TicketStatus.OPEN) {
        await tx.message.create({
          data: {
            tenantId: tenant.id,
            ticketId: ticket.id,
            authorId: assigneeId,
            authorType: 'agent',
            content: 'Grazie per la segnalazione. Ho preso in carico il ticket e ti aggiorno a breve.',
          },
        });
      }
    });
  }

  console.log(`✅ Tickets: ${ticketTemplates.length} tickets with messages`);

  // ─── WEBHOOK SAMPLE ───────────────────────────────────────────────────────
  await prisma.webhook.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      tenantId: tenant.id,
      name: 'Slack Notifications',
      url: 'https://hooks.slack.com/services/EXAMPLE',
      events: ['ticket.created', 'ticket.resolved'],
      secret: 'webhook-secret-example-change-me',
      isActive: false,
    },
  });

  console.log(`\n✅ Seeding complete!\n`);
  console.log(`📋 TEST CREDENTIALS:`);
  console.log(`   Admin:   admin@demo.com     / Password123!`);
  console.log(`   Agent:   marco.bianchi@demo.com / Password123!`);
  console.log(`   Agent:   sara.verdi@demo.com   / Password123!`);
  console.log(`   Agent:   luca.rossi@demo.com   / Password123!`);
  console.log(`   Viewer:  viewer@demo.com    / Password123!\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
