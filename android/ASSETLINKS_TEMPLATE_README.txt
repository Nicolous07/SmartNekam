Android Trusted Web Activity verification needs a real Digital Asset Links statement.
Do not upload a placeholder file. After PWABuilder generates the Android package,
copy the exact package ID and SHA-256 signing certificate fingerprint from the chosen
signing certificate, then create public/.well-known/assetlinks.json using Google's
current Digital Asset Links format and deploy it at:
https://smartnekam.vercel.app/.well-known/assetlinks.json
Official guide: https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities
