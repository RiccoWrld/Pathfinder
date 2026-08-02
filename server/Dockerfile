FROM node:22-alpine

# OCR tooling for rasterized DegreeWorks PDFs that contain no embedded text.
RUN apk add --no-cache poppler-utils tesseract-ocr tesseract-ocr-data-eng

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["npm", "start"]
