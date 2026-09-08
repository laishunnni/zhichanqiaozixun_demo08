import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { PDFFont } from 'pdf-lib'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const solutionsDir = path.resolve(currentDir, '../../uploads/solutions')
const fontsDir = path.resolve(currentDir, '../../assets/fonts')

fs.mkdirSync(solutionsDir, { recursive: true })

const SYSTEM_FONT_CANDIDATES = [
  'C:\\Windows\\Fonts\\msyh.ttc',
  'C:\\Windows\\Fonts\\msyh.ttf',
  'C:\\Windows\\Fonts\\simhei.ttf',
  'C:\\Windows\\Fonts\\simsun.ttc',
  '/System/Library/Fonts/PingFang.ttc',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
]

export interface SolutionInput {
  caseId: string
  userLoginId: string
  expertLoginId: string
  platforms: string[]
  otherPlatform?: string | null
  description: string
  contact?: string
}

export interface SolutionResult {
  fileName: string
  url: string
}

function loadCjkFont(): Uint8Array | null {
  const localCandidates = fs.existsSync(fontsDir)
    ? fs
        .readdirSync(fontsDir)
        .filter((f) => /\.(ttf|otf|ttc)$/i.test(f))
        .map((f) => path.join(fontsDir, f))
    : []
  for (const p of [...localCandidates, ...SYSTEM_FONT_CANDIDATES]) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p)
      }
    } catch {
      // 尝试下一个候选字体
    }
  }
  return null
}

function asciiFallback(text: string): string {
  return text.replace(/[^\x00-\x7F]/g, '?')
}

export async function generateSolutionPdf(input: SolutionInput): Promise<SolutionResult> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4

  let cjkFont: PDFFont | null = null
  const cjkBytes = loadCjkFont()
  if (cjkBytes) {
    try {
      cjkFont = await pdfDoc.embedFont(cjkBytes)
    } catch {
      cjkFont = null
    }
  }
  const fallback = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const useCjk = cjkFont !== null
  const font = cjkFont ?? fallback

  const sanitize = (text: string) => (useCjk ? text : asciiFallback(text))
  const blue = rgb(0.09, 0.47, 1)
  const dark = rgb(0.12, 0.14, 0.16)
  const gray = rgb(0.42, 0.45, 0.49)
  const white = rgb(1, 1, 1)

  // 知产桥 Logo（商标图标占位：蓝底圆角块 + 白色桥拱）
  page.drawRectangle({ x: 48, y: 742, width: 56, height: 56, color: blue })
  page.drawBezierCurve({
    start: { x: 56, y: 776 },
    c1: { x: 72, y: 754 },
    c2: { x: 80, y: 754 },
    end: { x: 96, y: 776 },
    borderColor: white,
    borderWidth: 4,
  })
  page.drawText(sanitize('知'), {
    x: 68,
    y: 756,
    size: 24,
    font,
    color: white,
  })

  // 标题
  page.drawText(sanitize('知识产权人工咨询解决方案'), {
    x: 120,
    y: 768,
    size: 22,
    font,
    color: blue,
  })
  page.drawText(sanitize('知产桥人工咨询平台'), {
    x: 120,
    y: 746,
    size: 11,
    font,
    color: gray,
  })

  const dateText = sanitize(new Date().toLocaleDateString('zh-CN'))
  page.drawText(sanitize('生成日期：') + dateText, {
    x: 440,
    y: 768,
    size: 10,
    font,
    color: gray,
  })

  // 案件信息
  let y = 700
  const metaLines = [
    `案件编号：${sanitize(input.caseId)}`,
    `委托用户：${sanitize(input.userLoginId)}`,
    `咨询专员：${sanitize(input.expertLoginId)}`,
    `联系方式：${sanitize(input.contact || '未提供')}`,
    `侵权平台：${sanitize(input.platforms.join('、') + (input.otherPlatform ? `（${input.otherPlatform}）` : ''))}`,
  ]
  for (const line of metaLines) {
    page.drawText(line, { x: 48, y, size: 11, font, color: dark })
    y -= 22
  }

  // 正文
  y -= 12
  const sections = [
    ['一、案件概况', `侵权描述：${sanitize(input.description)}`],
    [
      '二、侵权分析',
      '根据用户提交的材料与侵权平台信息，初步判断侵权行为存在以下特征：' +
        '（1）侵权主体未经授权使用相关知识产权；' +
        '（2）侵权内容已公开传播并对权利人造成影响。具体分析将由专员补充完善。',
    ],
    ['三、法律依据', '（待专员补充：相关法律条文与判例引用）'],
    ['四、处理建议', '（待专员补充：分步骤处理方案与时间安排）'],
    [
      '五、风险提示',
      '（1）侵权证据可能因平台删除而失效，请尽快固定公证；' +
        '（2）法律程序耗时存在不确定性，请以最终方案为准；' +
        '（3）本方案仅供内部沟通使用，不构成正式法律意见。',
    ],
  ]
  for (const [title, body] of sections) {
    page.drawText(sanitize(title), { x: 48, y, size: 13, font, color: blue })
    y -= 22
    const bodyLines = sanitize(body).match(/.{1,44}/g) ?? [sanitize(body)]
    for (const line of bodyLines) {
      page.drawText(line, { x: 48, y, size: 10.5, font, color: dark })
      y -= 18
    }
    y -= 14
  }

  // 页脚
  page.drawText(sanitize('知产桥人工咨询平台 · 一站式知识产权人工咨询服务平台'), {
    x: 48,
    y: 40,
    size: 9,
    font,
    color: gray,
  })

  const fileName = `solution-${input.caseId}.pdf`
  const filePath = path.join(solutionsDir, fileName)
  const pdfBytes = await pdfDoc.save()
  fs.writeFileSync(filePath, pdfBytes)

  return {
    fileName,
    url: `/uploads/solutions/${fileName}`,
  }
}
