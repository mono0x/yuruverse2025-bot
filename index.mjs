import fs from "fs/promises"
import path from "path"
import os from "os"
import puppeteer from "puppeteer"
import Twitter from "twitter-lite"
import format from "date-fns-tz/format/index.js"

(async () => {
    const urls = [
        "https://yurugp2020.mono0x.net/charts/LOCAL",
        "https://yurugp2020.mono0x.net/charts/COMPANY",
    ]

    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    await page.setViewport({
        width: 512,
        height: 512,
        deviceScaleFactor: 2,
    })

    const uploadClient = new Twitter({
        subdomain: "upload",
        consumer_key: process.env.TWITTER_CONSUMER_KEY,
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
        access_token_key: process.env.TWITTER_OAUTH_TOKEN,
        access_token_secret: process.env.TWITTER_OAUTH_SECRET,
    })

    const mediaIds = []
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i]
        const imagePath = path.join(os.tmpdir(), `${i}.png`)
        await page.goto(url, { waitUntil: "networkidle0" })
        await page.screenshot({ path: imagePath })
        const image = await fs.readFile(imagePath, "base64")
        const media = await uploadClient.post("media/upload", {
            media_data: image,
        })
        mediaIds.push(media.media_id_string)
    }

    await browser.close()

    const client = new Twitter({
        consumer_key: process.env.TWITTER_CONSUMER_KEY,
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
        access_token_key: process.env.TWITTER_OAUTH_TOKEN,
        access_token_secret: process.env.TWITTER_OAUTH_SECRET,
    })

    const date = format(new Date(), "M月d日", { timeZone: "Asia/Tokyo" })
    const status = `#ゆるキャラグランプリ2020 ${date}現在のランキング\n\n詳細な投票状況はこちら: https://yurugp2020.mono0x.net/\n投票はこちら: https://www.yurugp.jp/jp/vote/`
    console.log(status)

    await client.post("statuses/update", {
        status: status,
        media_ids: mediaIds.join(","),
    })
})()
