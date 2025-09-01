import * as os from "node:os"
import * as path from "node:path"
import * as util from "node:util"
import { format } from "date-fns-tz/format"
import puppeteer, { type Page } from "puppeteer"
import { TwitterApi } from "twitter-api-v2"

type Rule = {
  viewport: {
    width: number
    height: number
    deviceScaleFactor: number
  }
  url: string
}

const deviceScaleFactor = 3

const rules: Rule[] = [
  {
    viewport: {
      width: 512,
      height: 1, // fit to page height
      deviceScaleFactor,
    },
    url: "https://yuruverse2025.mono0x.net/table",
  },
  {
    viewport: {
      width: 512,
      height: 512,
      deviceScaleFactor,
    },
    url: "https://yuruverse2025.mono0x.net/chart",
  },
]

const { values } = util.parseArgs({
  options: {
    export: {
      type: "boolean",
      default: false,
    },
  },
})

const { export: exportMode } = values

const takeScreenshot = async (
  page: Page,
  rule: Rule,
  name: string,
): Promise<string> => {
  await page.setViewport(rule.viewport)
  await page.goto(rule.url, { waitUntil: "networkidle0" })
  await page.screenshot({ path: `${name}.png`, fullPage: true })
  return `${name}.png`
}

const post = async (page: Page) => {
  const {
    TWITTER_APP_KEY: appKey,
    TWITTER_APP_SECRET: appSecret,
    TWITTER_ACCESS_TOKEN: accessToken,
    TWITTER_ACCESS_SECRET: accessSecret,
  } = process.env
  if (
    appKey == null ||
    appSecret == null ||
    accessToken == null ||
    accessSecret == null
  ) {
    throw new Error(
      "Twitter API credentials are not set in environment variables.",
    )
  }
  const client = new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  })

  const mediaIds: string[] = []
  for (const [i, rule] of Object.entries(rules)) {
    const p = await takeScreenshot(page, rule, path.join(os.tmpdir(), `${i}`))
    const mediaId = await client.v1.uploadMedia(p)
    mediaIds.push(mediaId)
  }

  const date = format(new Date(), "M月d日", { timeZone: "Asia/Tokyo" })
  const status = `#ゆるバース2025 ${date}現在のランキング\n\n詳細な投票状況はこちら: https://yuruverse2025.mono0x.net/\n投票はこちら: https://www.yurugp.jp/vote/2025/`

  const tweet = await client.v2.tweet({
    text: status,
    media: { media_ids: [mediaIds[0]] },
  })

  await client.v2.tweet({
    text: "これまでの投票数のグラフはこちら",
    media: { media_ids: [mediaIds[1]] },
    reply: { in_reply_to_tweet_id: tweet.data.id },
  })
}

const exportScreenshots = async (page: Page) => {
  for (const [i, rule] of Object.entries(rules)) {
    await takeScreenshot(page, rule, `screenshot_${i}`)
  }
}

const browser = await puppeteer.launch({
  args: ["--lang=ja"],
})
try {
  const page = await browser.newPage()
  if (exportMode) {
    await exportScreenshots(page)
  } else {
    await post(page)
  }
} finally {
  await browser.close()
}
