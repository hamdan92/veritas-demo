use anyhow::{Context, Result};
use image::{DynamicImage, Rgb, RgbImage};

/// RGB pixel vectors - the format VerITAS expects
pub struct PixelVectors {
    pub r: Vec<u8>,
    pub g: Vec<u8>,
    pub b: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

impl PixelVectors {
    /// Total number of pixels
    pub fn pixel_count(&self) -> usize {
        self.r.len()
    }
}

/// Convert an image to separate R, G, B vectors
pub fn image_to_pixel_vectors(img: &DynamicImage) -> PixelVectors {
    let rgb_img = img.to_rgb8();
    let (width, height) = rgb_img.dimensions();
    
    let mut r = Vec::with_capacity((width * height) as usize);
    let mut g = Vec::with_capacity((width * height) as usize);
    let mut b = Vec::with_capacity((width * height) as usize);
    
    // Row-major order (matches typical image layout)
    for y in 0..height {
        for x in 0..width {
            let pixel = rgb_img.get_pixel(x, y);
            r.push(pixel[0]);
            g.push(pixel[1]);
            b.push(pixel[2]);
        }
    }
    
    PixelVectors { r, g, b, width, height }
}

/// Convert R, G, B vectors back to an image
pub fn pixel_vectors_to_image(pixels: &PixelVectors) -> Result<RgbImage> {
    let expected_len = (pixels.width * pixels.height) as usize;
    
    if pixels.r.len() != expected_len || pixels.g.len() != expected_len || pixels.b.len() != expected_len {
        anyhow::bail!(
            "Pixel vector length mismatch: expected {}, got r={}, g={}, b={}",
            expected_len, pixels.r.len(), pixels.g.len(), pixels.b.len()
        );
    }
    
    let mut img = RgbImage::new(pixels.width, pixels.height);
    
    for y in 0..pixels.height {
        for x in 0..pixels.width {
            let idx = (y * pixels.width + x) as usize;
            img.put_pixel(x, y, Rgb([pixels.r[idx], pixels.g[idx], pixels.b[idx]]));
        }
    }
    
    Ok(img)
}

/// Load an image from bytes
pub fn load_image_from_bytes(bytes: &[u8]) -> Result<DynamicImage> {
    image::load_from_memory(bytes).context(
        "Failed to load image. Supported formats: PNG, JPEG, WebP, GIF. HEIC/HEIF is NOT supported."
    )
}

/// Encode an image to PNG bytes
pub fn image_to_png_bytes(img: &RgbImage) -> Result<Vec<u8>> {
    use image::ImageEncoder;
    let mut bytes = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut bytes);
    encoder.write_image(
        img.as_raw(),
        img.width(),
        img.height(),
        image::ColorType::Rgb8,
    ).context("Failed to encode image to PNG")?;
    Ok(bytes)
}

/// Apply cropping to pixel vectors
pub fn crop_pixels(pixels: &PixelVectors, x: u32, y: u32, width: u32, height: u32) -> Result<PixelVectors> {
    if x + width > pixels.width || y + height > pixels.height {
        anyhow::bail!(
            "Crop region ({},{} {}x{}) exceeds image bounds ({}x{})",
            x, y, width, height, pixels.width, pixels.height
        );
    }
    
    let new_len = (width * height) as usize;
    let mut r = Vec::with_capacity(new_len);
    let mut g = Vec::with_capacity(new_len);
    let mut b = Vec::with_capacity(new_len);
    
    for row in y..(y + height) {
        for col in x..(x + width) {
            let idx = (row * pixels.width + col) as usize;
            r.push(pixels.r[idx]);
            g.push(pixels.g[idx]);
            b.push(pixels.b[idx]);
        }
    }
    
    Ok(PixelVectors { r, g, b, width, height })
}

/// Apply grayscale conversion using Photoshop formula
/// gray = round(0.30*R + 0.59*G + 0.11*B)
pub fn grayscale_pixels(pixels: &PixelVectors) -> PixelVectors {
    let len = pixels.r.len();
    let mut gray = Vec::with_capacity(len);
    
    for i in 0..len {
        let r = pixels.r[i] as f64;
        let g = pixels.g[i] as f64;
        let b = pixels.b[i] as f64;
        let val = (0.30 * r + 0.59 * g + 0.11 * b).round() as u8;
        gray.push(val);
    }
    
    // Return grayscale as RGB (all channels same)
    PixelVectors {
        r: gray.clone(),
        g: gray.clone(),
        b: gray,
        width: pixels.width,
        height: pixels.height,
    }
}

/// Apply box blur to a region
pub fn blur_pixels(pixels: &PixelVectors, bx: u32, by: u32, bw: u32, bh: u32) -> Result<PixelVectors> {
    if bx + bw > pixels.width || by + bh > pixels.height {
        anyhow::bail!(
            "Blur region ({},{} {}x{}) exceeds image bounds ({}x{})",
            bx, by, bw, bh, pixels.width, pixels.height
        );
    }
    
    let mut result = PixelVectors {
        r: pixels.r.clone(),
        g: pixels.g.clone(),
        b: pixels.b.clone(),
        width: pixels.width,
        height: pixels.height,
    };
    
    // 3x3 box blur for pixels in the blur region (excluding edges)
    for y in (by + 1)..(by + bh - 1) {
        for x in (bx + 1)..(bx + bw - 1) {
            let mut sum_r = 0u32;
            let mut sum_g = 0u32;
            let mut sum_b = 0u32;
            
            // 3x3 neighborhood
            for dy in -1i32..=1 {
                for dx in -1i32..=1 {
                    let nx = (x as i32 + dx) as u32;
                    let ny = (y as i32 + dy) as u32;
                    let idx = (ny * pixels.width + nx) as usize;
                    sum_r += pixels.r[idx] as u32;
                    sum_g += pixels.g[idx] as u32;
                    sum_b += pixels.b[idx] as u32;
                }
            }
            
            let idx = (y * pixels.width + x) as usize;
            result.r[idx] = (sum_r / 9) as u8;
            result.g[idx] = (sum_g / 9) as u8;
            result.b[idx] = (sum_b / 9) as u8;
        }
    }
    
    Ok(result)
}

/// Apply bilinear resize
pub fn resize_pixels(pixels: &PixelVectors, new_width: u32, new_height: u32) -> PixelVectors {
    let mut r = Vec::with_capacity((new_width * new_height) as usize);
    let mut g = Vec::with_capacity((new_width * new_height) as usize);
    let mut b = Vec::with_capacity((new_width * new_height) as usize);
    
    let x_ratio = (pixels.width - 1) as f64 / (new_width - 1).max(1) as f64;
    let y_ratio = (pixels.height - 1) as f64 / (new_height - 1).max(1) as f64;
    
    for y in 0..new_height {
        for x in 0..new_width {
            let src_x = x as f64 * x_ratio;
            let src_y = y as f64 * y_ratio;
            
            let x_l = src_x.floor() as u32;
            let y_l = src_y.floor() as u32;
            let x_h = (x_l + 1).min(pixels.width - 1);
            let y_h = (y_l + 1).min(pixels.height - 1);
            
            let x_weight = src_x - x_l as f64;
            let y_weight = src_y - y_l as f64;
            
            let idx_tl = (y_l * pixels.width + x_l) as usize;
            let idx_tr = (y_l * pixels.width + x_h) as usize;
            let idx_bl = (y_h * pixels.width + x_l) as usize;
            let idx_br = (y_h * pixels.width + x_h) as usize;
            
            // Bilinear interpolation for each channel
            let interp = |vals: &[u8]| -> u8 {
                let top = vals[idx_tl] as f64 * (1.0 - x_weight) + vals[idx_tr] as f64 * x_weight;
                let bot = vals[idx_bl] as f64 * (1.0 - x_weight) + vals[idx_br] as f64 * x_weight;
                (top * (1.0 - y_weight) + bot * y_weight).round() as u8
            };
            
            r.push(interp(&pixels.r));
            g.push(interp(&pixels.g));
            b.push(interp(&pixels.b));
        }
    }
    
    PixelVectors { r, g, b, width: new_width, height: new_height }
}
