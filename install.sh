
# --- Watch Dragon (auto-healing) ---
sudo cp watch-dragon.sh /usr/local/bin/watch-dragon.sh
sudo chmod +x /usr/local/bin/watch-dragon.sh
(crontab -l 2>/dev/null; echo "* * * * * /usr/local/bin/watch-dragon.sh") | crontab -

# --- PM2 startup on boot ---
pm2 save
sudo env PATH=$PATH:/home/$(whoami)/.nvm/versions/node/v20.20.2/bin \
  /home/$(whoami)/.nvm/versions/node/v20.20.2/lib/node_modules/pm2/bin/pm2 startup systemd -u $(whoami) --hp /home/$(whoami)
