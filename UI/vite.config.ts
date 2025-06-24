// File: D:\Didar1520\CRM\UI\vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      // Каждое API-плечо отправляем на ваш Node-сервер (порт 8080)
      '/ordersData': 'http://localhost:8080',
      '/saveOrdersData': 'http://localhost:8080',
      '/ordersSettings': 'http://localhost:8080',
      '/saveOrdersSettings': 'http://localhost:8080',
      '/clientData': 'http://localhost:8080',
      '/saveClientData': 'http://localhost:8080',
      '/accData': 'http://localhost:8080',
      '/saveAccData': 'http://localhost:8080',
      '/recalculateDebt': { target: 'http://localhost:8080', changeOrigin: true },
      //  Плюс, если нужно, '/inputConfig', '/saveConfig', '/runOrders' и т. д.
       '/inputConfig': 'http://localhost:8080',
       '/saveConfig': 'http://localhost:8080',
       '/runOrders': 'http://localhost:8080',
       
    } }
})