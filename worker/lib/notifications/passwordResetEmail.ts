import { BRAND } from "@shared/branding";

/** The single-use reset link is Better Auth's own URL — never a token we construct. */
export function buildPasswordResetEmail(resetUrl: string): { html: string; text: string } {
	const html = `<!doctype html>
<html lang="en-ZA">
	<body style="margin:0;padding:0;background-color:${BRAND.colors.background};font-family:Arial,Helvetica,sans-serif;color:#f5f1ec;">
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.colors.background};padding:32px 16px;">
			<tr>
				<td align="center">
					<table role="presentation" width="100%" style="max-width:480px;background-color:#1e1a17;border-radius:16px;padding:32px;">
						<tr>
							<td style="text-align:center;padding-bottom:24px;">
								<span style="font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:${BRAND.colors.secondary};">${BRAND.rewardsName}</span>
							</td>
						</tr>
						<tr>
							<td>
								<h1 style="margin:0 0 16px;font-size:22px;color:#f5f1ec;">Reset your password</h1>
								<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#cfc7bd;">
									We received a request to reset the password for your ${BRAND.shortName} account. Click the button below to choose a new password.
								</p>
							</td>
						</tr>
						<tr>
							<td style="padding:8px 0 24px;text-align:center;">
								<a href="${resetUrl}" style="display:inline-block;background-color:${BRAND.colors.primary};color:${BRAND.colors.background};font-weight:bold;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:9999px;">
									Reset password
								</a>
							</td>
						</tr>
						<tr>
							<td>
								<p style="margin:0;font-size:13px;line-height:1.5;color:#9a938a;">
									If you didn't request a password reset, you can safely ignore this email — your password will not be changed.
								</p>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>`;

	const text = `Reset your ${BRAND.shortName} password

We received a request to reset the password for your ${BRAND.shortName} account.

Reset your password using this link:
${resetUrl}

If you didn't request a password reset, you can safely ignore this email — your password will not be changed.`;

	return { html, text };
}
