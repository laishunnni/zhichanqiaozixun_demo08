import Dysmsapi20170525, { SendSmsRequest } from '@alicloud/dysmsapi20170525'
import * as OpenApi from '@alicloud/openapi-client'
import * as Util from '@alicloud/tea-util'
import { env } from '../config/env'

/**
 * 阿里云短信：发送验证码。
 * 未配置 AccessKey 时抛出明确错误，避免静默失败。
 */
export async function sendSms(
  phone: string,
  templateCode: string,
  params: Record<string, string>,
): Promise<void> {
  if (
    !env.smsAccessKeyId ||
    !env.smsAccessKeySecret ||
    !env.smsSignName ||
    !templateCode
  ) {
    throw new Error('短信服务未配置，请在 backend/.env 填写阿里云短信参数')
  }

  const config = new OpenApi.Config({
    accessKeyId: env.smsAccessKeyId,
    accessKeySecret: env.smsAccessKeySecret,
  })
  config.endpoint = 'dysmsapi.aliyuncs.com'

  const client = new Dysmsapi20170525(config)
  const request = new SendSmsRequest({
    phoneNumbers: phone,
    signName: env.smsSignName,
    templateCode: templateCode,
    templateParam: JSON.stringify(params),
  })

  const runtime = new Util.RuntimeOptions({})
  await client.sendSmsWithOptions(request, runtime)
}
