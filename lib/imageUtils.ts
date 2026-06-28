export async function compressImage(file: File, maxSizeKB: number = 100): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Max dimensions to maintain quality but reduce size initially
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1920;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(event.target?.result as string); // fallback
        }
        
        // Fill white background for transparent images if converting to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.9;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Approximate size of base64 string in KB
        let sizeKB = (dataUrl.length * 0.75) / 1024;

        // Iteratively reduce quality and/or dimensions to hit the target size
        while (sizeKB > maxSizeKB && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          sizeKB = (dataUrl.length * 0.75) / 1024;
        }

        // If it's still too big at lowest quality, scale down the resolution
        while (sizeKB > maxSizeKB && canvas.width > 300) {
          canvas.width *= 0.8;
          canvas.height *= 0.8;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          sizeKB = (dataUrl.length * 0.75) / 1024;
        }

        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}
