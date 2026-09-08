import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// 平台管理端账号：以《管理员名单-密码表.xlsx》为准
const ADMIN_ACCOUNTS = [
  { loginId: 'ADMIN1', password: 'admin01' },
  { loginId: 'ADMIN2', password: 'admin02' },
  { loginId: 'ADMIN3', password: 'admin03' },
  { loginId: 'ADMIN4', password: 'admin04' },
  { loginId: 'ADMIN5', password: 'admin05' },
]

// 咨询专员端账号：以《咨询值班人员目录-密码.xlsx》为准
const EXPERT_ACCOUNTS = [
  { loginId: 'ZX20260001', password: '20260001' },
  { loginId: 'ZX20260002', password: '20260002' },
  { loginId: 'ZX20260003', password: '20260003' },
  { loginId: 'ZX20260004', password: '20260004' },
  { loginId: 'ZX20260005', password: '20260005' },
  { loginId: 'ZX20260006', password: '20260006' },
  { loginId: 'ZX20260007', password: '20260007' },
  { loginId: 'ZX20260008', password: '20260008' },
  { loginId: 'ZX20260009', password: '20260009' },
  { loginId: 'ZX20260010', password: '20260010' },
]

async function main() {
  const userHash = await bcrypt.hash('123456', 10)

  const dateStr = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  // 平台管理端：按名单创建/更新（重新执行 seed 会刷新密码为名单值）
  for (const account of ADMIN_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(account.password, 10)
    await prisma.user.upsert({
      where: { loginId: account.loginId },
      update: { passwordHash, mustChangePassword: false },
      create: {
        role: 'ADMIN',
        loginId: account.loginId,
        passwordHash,
        mustChangePassword: false,
      },
    })
  }

  // 咨询专员端：按目录创建/更新（重新执行 seed 会刷新密码为目录值）
  const expertIds: string[] = []
  for (const account of EXPERT_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(account.password, 10)
    const expert = await prisma.user.upsert({
      where: { loginId: account.loginId },
      update: { passwordHash, mustChangePassword: false },
      create: {
        role: 'EXPERT',
        loginId: account.loginId,
        passwordHash,
        mustChangePassword: false,
      },
    })
    expertIds.push(expert.id)
  }

  // 用户端：邮箱 + 密码示例账号
  await prisma.user.upsert({
    where: { loginId: 'demo@zhichanqiao.com' },
    update: {},
    create: {
      role: 'USER',
      loginId: 'demo@zhichanqiao.com',
      email: 'demo@zhichanqiao.com',
      passwordHash: userHash,
      mustChangePassword: false,
    },
  })

  // 为目录内专员设置今日全天值班（匹配引擎只从值班中的空闲专员分配）
  const today = dateStr(new Date())
  for (const expertId of expertIds) {
    for (const period of ['MORNING', 'AFTERNOON', 'EVENING'] as const) {
      await prisma.expertShift.upsert({
        where: { expertId_date_period: { expertId, date: today, period } },
        update: { isOnDuty: true },
        create: { expertId, date: today, period, isOnDuty: true },
      })
    }
  }

  console.log('[seed] 初始账号已就绪：')
  console.log('  管理端：ADMIN1-ADMIN5（密码 admin01-admin05，以管理员名单-密码表为准）')
  console.log('  专员端：ZX20260001-ZX20260010（密码 20260001-20260010，以值班人员目录-密码为准）')
  console.log('  用户端：demo@zhichanqiao.com / 123456（任意手机号或邮箱可注册）')
}

main()
  .catch((err) => {
    console.error('[seed] 失败：', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
