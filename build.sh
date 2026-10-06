#!/bin/bash
# 把 src/ 合併成：
#   二戰成因溫習.html  —— 單一 HTML 檔案（直接用瀏覽器打開／傳畀同學）
#   index.html         —— Artifact 發布版（冇 doctype/head/body，發布時自動加）
cd "$(dirname "$0")"
FONTS='<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Big+Shoulders+Display:wght@700;800&family=Courier+Prime:wght@400;700&display=swap">'
OUT="二戰成因溫習.html"
{
  echo '<!doctype html>'
  echo '<html lang="en">'
  echo '<head>'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  echo '<title>Road to WWII</title>'
  echo '<script>'; cat src/1-data.js; echo '</script>'
  echo "$FONTS"
  echo '<style>'; cat src/2-style.css; echo '</style>'
  echo '</head>'
  echo '<body>'
  cat src/3-body.html
  echo '<script>'; cat src/4-core.js src/5-review.js src/6-quiz.js; echo 'boot();'; echo '</script>'
  echo '</body>'
  echo '</html>'
} > "$OUT"
{
  echo '<title>Road to WWII</title>'
  echo '<script>'; cat src/1-data.js; echo '</script>'
  echo "$FONTS"
  echo '<style>'; cat src/2-style.css; echo '</style>'
  cat src/3-body.html
  echo '<script>'; cat src/4-core.js src/5-review.js src/6-quiz.js; echo 'boot();'; echo '</script>'
} > index.html
echo "built $OUT ($(wc -c < "$OUT") bytes) + index.html"
# GitHub Pages 版本（main 分支 /docs）
mkdir -p docs && cp "$OUT" docs/index.html && touch docs/.nojekyll
