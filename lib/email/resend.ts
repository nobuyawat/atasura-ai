/**
 * Resend メール送信クライアント
 *
 * 環境変数:
 *   RESEND_API_KEY       – Resend API キー
 *   RESEND_FROM_EMAIL    – 送信元 (例: "アタスラAI <noreply@yourdomain.com>")
 *   ADMIN_EMAIL          – 運営通知先 (例: "kmnworks100@gmail.com")
 *   PUBLIC_APP_URL       – アプリURL (例: "https://atasura-ai.vercel.app")
 */

import { Resend } from 'resend';

// Resend クライアントは遅延初期化（ビルド時にAPIキーが無くてもエラーにしない）
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    _resend = new Resend(key);
  }
  return _resend;
}

function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || 'アタスラAI <onboarding@resend.dev>';
}

function getAdminEmail(): string {
  return process.env.ADMIN_EMAIL || 'kmnworks100@gmail.com';
}

function getAppUrl(): string {
  return (
    process.env.PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'https://atasura-ai.vercel.app'
  );
}

/* ------------------------------------------------------------------ */
/*  Welcome Email                                                      */
/* ------------------------------------------------------------------ */

interface WelcomeEmailParams {
  to: string;
  name?: string;
  plan?: string;
}

export async function sendWelcomeEmail({ to, name, plan }: WelcomeEmailParams) {
  const greeting = name ? `${name} 様` : 'お客様';
  const planLabel = plan || 'ご契約プラン';

  const baseUrl = getAppUrl();
  const loginUrl = `${baseUrl}/login`;
  const appPageUrl = `${baseUrl}/app`;
  const howtoUrl = `${baseUrl}/howto`;

  const subject =
    '【アタスラAI】ご契約ありがとうございます｜最初の1分ガイド';

  // ── HTML 本文 ─────────────────────────────────────
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f7f7f8;font-family:'Helvetica Neue',Arial,'Hiragino Sans',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f8;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">
              アタスラAI
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 18px;font-size:16px;color:#1a1a2e;line-height:1.7;">
              ${greeting}、<br>
              <strong>${planLabel}</strong> へのご契約、誠にありがとうございます！
            </p>

            <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.7;">
              さっそく台本を作ってみましょう。<br>
              ログイン後、数クリックで5分の台本が完成します。
            </p>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:8px 0 24px;">
                <a href="${loginUrl}"
                   style="display:inline-block;padding:14px 40px;background:#6366f1;color:#ffffff;
                          font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;">
                  ログインして始める
                </a>
              </td></tr>
            </table>

            <!-- Steps -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7ff;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
              <tr><td>
                <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#6366f1;">
                  ▶ 最初の1分ガイド
                </p>
                <ol style="margin:0;padding-left:20px;font-size:14px;color:#333;line-height:2;">
                  <li>上のボタンからログイン</li>
                  <li>「新しい台本を作る」をクリック</li>
                  <li>テーマを入力 → AIが台本を自動生成！</li>
                </ol>
              </td></tr>
            </table>

            <!-- Links -->
            <p style="margin:0 0 6px;font-size:13px;color:#888;">
              ■ ログインページ：<a href="${loginUrl}" style="color:#6366f1;">${loginUrl}</a>
            </p>
            <p style="margin:0 0 6px;font-size:13px;color:#888;">
              ■ 使い方ガイド：<a href="${howtoUrl}" style="color:#6366f1;">${howtoUrl}</a>
            </p>
            <p style="margin:0 0 6px;font-size:13px;color:#888;">
              ■ アプリ画面：<a href="${appPageUrl}" style="color:#6366f1;">${appPageUrl}</a>
            </p>

            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />

            <p style="margin:0;font-size:13px;color:#999;line-height:1.6;">
              ご不明な点がございましたら、このメールにそのままご返信ください。<br>
              サポート担当が対応いたします。
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;padding:18px 32px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;font-size:11px;color:#bbb;">
              &copy; アタスラAI — 台本作成をもっとかんたんに
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  // ── テキスト本文 ───────────────────────────────────
  const text = `
【アタスラAI】ご契約ありがとうございます

${greeting}、
${planLabel} へのご契約、誠にありがとうございます！

さっそく台本を作ってみましょう。
ログイン後、数クリックで5分の台本が完成します。

▶ 最初の1分ガイド
1. ログインページにアクセス → ${loginUrl}
2. 「新しい台本を作る」をクリック
3. テーマを入力 → AIが台本を自動生成！

■ ログインページ: ${loginUrl}
■ 使い方ガイド: ${howtoUrl}
■ アプリ画面: ${appPageUrl}

──────────────────────
ご不明な点がございましたら、このメールにそのままご返信ください。
サポート担当が対応いたします。

© アタスラAI — 台本作成をもっとかんたんに
`.trim();

  // ── 送信 ──────────────────────────────────────────
  const result = await getResend().emails.send({
    from: getFromEmail(),
    to,
    subject,
    html,
    text,
  });

  return result;
}

/* ------------------------------------------------------------------ */
/*  Refund Request — Admin Notification                                */
/* ------------------------------------------------------------------ */

interface RefundNotificationParams {
  userEmail: string;
  purchaseDate: string;
  reason: string;
  userId: string;
}

/**
 * 返金申請の運営通知メール
 * 管理者（ADMIN_EMAIL）宛に返金申請の内容を送信する
 */
export async function sendRefundAdminNotification({
  userEmail,
  purchaseDate,
  reason,
  userId,
}: RefundNotificationParams) {
  const adminEmail = getAdminEmail();
  const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

  const subject = `【アタスラAI】返金申請がありました - ${userEmail}`;

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f7f7f8;font-family:'Helvetica Neue',Arial,'Hiragino Sans',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f8;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:#ef4444;padding:20px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">返金申請通知</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <table width="100%" cellpadding="8" cellspacing="0" style="font-size:14px;color:#333;">
              <tr>
                <td style="font-weight:700;color:#666;width:120px;">申請日時</td>
                <td>${now}</td>
              </tr>
              <tr>
                <td style="font-weight:700;color:#666;">ユーザーEmail</td>
                <td>${userEmail}</td>
              </tr>
              <tr>
                <td style="font-weight:700;color:#666;">ユーザーID</td>
                <td style="font-size:12px;color:#888;">${userId}</td>
              </tr>
              <tr>
                <td style="font-weight:700;color:#666;">購入日</td>
                <td>${purchaseDate}</td>
              </tr>
              <tr>
                <td style="font-weight:700;color:#666;vertical-align:top;">返金理由</td>
                <td style="white-space:pre-wrap;">${reason}</td>
              </tr>
            </table>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
            <p style="margin:0;font-size:13px;color:#999;">
              Stripe Dashboard で該当ユーザーを確認し、返金処理を行ってください。<br>
              Supabase の refund_requests テーブルにもレコードが保存されています。
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const text = `
【アタスラAI】返金申請通知

申請日時: ${now}
ユーザーEmail: ${userEmail}
ユーザーID: ${userId}
購入日: ${purchaseDate}
返金理由: ${reason}

Stripe Dashboard で該当ユーザーを確認し、返金処理を行ってください。
`.trim();

  const result = await getResend().emails.send({
    from: getFromEmail(),
    to: adminEmail,
    subject,
    html,
    text,
  });

  return result;
}

/* ------------------------------------------------------------------ */
/*  Refund Request — User Confirmation                                 */
/* ------------------------------------------------------------------ */

interface RefundUserConfirmationParams {
  to: string;
}

/**
 * 返金申請受付確認メール（ユーザー宛）
 */
export async function sendRefundUserConfirmation({ to }: RefundUserConfirmationParams) {
  const subject = '【アタスラAI】返金申請を受け付けました';

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f7f7f8;font-family:'Helvetica Neue',Arial,'Hiragino Sans',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f8;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">アタスラAI</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 18px;font-size:16px;color:#1a1a2e;line-height:1.7;">
              返金申請を受け付けました。
            </p>
            <p style="margin:0 0 18px;font-size:15px;color:#444;line-height:1.7;">
              内容を確認のうえ、通常1〜3営業日以内にメールでご連絡いたします。<br>
              返金が承認された場合、ご利用のクレジットカードに返金されます。
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
            <p style="margin:0;font-size:13px;color:#999;line-height:1.6;">
              ご不明な点がございましたら、このメールにそのままご返信ください。
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#fafafa;padding:18px 32px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;font-size:11px;color:#bbb;">&copy; アタスラAI</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const text = `
【アタスラAI】返金申請を受け付けました

返金申請を受け付けました。
内容を確認のうえ、通常1〜3営業日以内にメールでご連絡いたします。
返金が承認された場合、ご利用のクレジットカードに返金されます。

ご不明な点がございましたら、このメールにそのままご返信ください。
`.trim();

  const result = await getResend().emails.send({
    from: getFromEmail(),
    to,
    subject,
    html,
    text,
  });

  return result;
}
