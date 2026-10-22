cd /var/www/LocalGo-BE
cp -a dist /var/www/backups/localgo-be-dist-before-trade-reviews-$(date +%Y%m%d-%H%M%S)
npm run build && pm2 restart localgo-be
curl -s "http://127.0.0.1:3015/api/v1/trade-posts?limit=1" | head -c 200    # 200
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3015/api/v1/admin/reviews/stats   # 401
