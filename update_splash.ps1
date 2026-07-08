$b64 = Get-Content C:\AgTech\Apps\metabuilder-pro\base64_icon_128.txt
$html = Get-Content C:\AgTech\Apps\metabuilder-pro\src-tauri\splash.html -Raw
$html = $html -replace '(?s)<svg xmlns.*?<\/svg>', "<img src=`"data:image/png;base64,$b64`" alt=`"Logo`" />"
$html = $html -replace '\.logo-box svg', '.logo-box img'
$html = $html -replace 'width: 48px; height: 48px;', 'width: 48px; height: 48px; object-fit: contain;'
$html | Out-File -FilePath C:\AgTech\Apps\metabuilder-pro\src-tauri\splash.html -Encoding UTF8
