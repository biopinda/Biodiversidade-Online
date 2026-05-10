const { spawn } = require('child_process')
const cron = require('node-cron')
const path = require('path')

// Função para executar o job de cache
function runDashboardCacheJob() {
  console.log('=== INICIANDO JOB DE CACHE DO DASHBOARD ===')
  console.log(`Executando em: ${new Date().toISOString()}`)

  const scriptPath = path.join(
    __dirname,
    'src',
    'scripts',
    'dashboard-cache-job.ts'
  )

  // Executar o script TypeScript usando tsx
  const child = spawn('npx', ['tsx', scriptPath], {
    stdio: 'inherit',
    cwd: __dirname
  })

  child.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Job de cache do dashboard executado com sucesso')
    } else {
      console.error(`❌ Job de cache do dashboard falhou com código: ${code}`)
    }
  })

  child.on('error', (error) => {
    console.error('❌ Erro ao executar job de cache do dashboard:', error)
  })
}

// Agendar o job para executar todas as segundas-feiras às 01:00
console.log('📅 Configurando agendamento do job de cache do dashboard...')
console.log('⏰ Job será executado semanalmente nas segundas-feiras às 01:00')

cron.schedule(
  '0 1 * * 1',
  () => {
    runDashboardCacheJob()
  },
  {
    scheduled: true,
    timezone: 'America/Sao_Paulo'
  }
)

// Executar uma vez imediatamente na inicialização
console.log('🚀 Executando job inicial...')
runDashboardCacheJob()

console.log('✅ Sistema de cache do dashboard configurado e rodando!')
