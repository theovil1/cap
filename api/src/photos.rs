//! Lighter route photos: a 1600 px picture for the gallery and a 720 px
//! thumbnail for the Explorer lists, both JPEG.

use image::{ImageReader, codecs::jpeg::JpegEncoder, imageops::FilterType};
use sqlx::PgPool;
use std::io::Cursor;

use crate::error::{AppError, AppResult};

pub const FULL_WIDTH: u32 = 1600;
pub const THUMB_WIDTH: u32 = 720;

/// The picture at most `width` pixels wide, as a JPEG.
pub fn shrink(bytes: &[u8], width: u32, quality: u8) -> AppResult<Vec<u8>> {
    let image = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(AppError::internal)?
        .decode()
        .map_err(|_| AppError::bad_request("invalid_image", "the image cannot be read"))?;
    let image = if image.width() > width {
        let height = image.height() * width / image.width();
        image.resize_exact(width, height, FilterType::Triangle)
    } else {
        image
    };
    let mut out = Vec::new();
    JpegEncoder::new_with_quality(&mut out, quality)
        .encode_image(&image.to_rgb8())
        .map_err(AppError::internal)?;
    Ok(out)
}

/// The gallery picture and the thumbnail of a sent photo, off the async threads.
pub async fn prepare(bytes: Vec<u8>) -> AppResult<(Vec<u8>, Vec<u8>)> {
    tokio::task::spawn_blocking(move || {
        Ok((shrink(&bytes, FULL_WIDTH, 82)?, shrink(&bytes, THUMB_WIDTH, 76)?))
    })
    .await
    .map_err(AppError::internal)?
}

/// Photos saved before thumbnails existed get theirs, and a lighter picture.
pub async fn backfill(db: &PgPool) -> AppResult<()> {
    let rows =
        sqlx::query!("SELECT public_route_id, kind, image FROM public_route_photos WHERE thumb IS NULL")
            .fetch_all(db)
            .await?;
    for row in rows {
        let (full, thumb) = prepare(row.image).await?;
        sqlx::query!(
            "UPDATE public_route_photos SET image = $3, thumb = $4, content_type = 'image/jpeg', updated_at = now()
             WHERE public_route_id = $1 AND kind = $2",
            row.public_route_id,
            row.kind,
            full,
            thumb
        )
        .execute(db)
        .await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shrinks_to_the_width() {
        let image = image::RgbImage::from_pixel(2000, 1000, image::Rgb([200, 120, 40]));
        let mut png = Vec::new();
        image::DynamicImage::ImageRgb8(image)
            .write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png)
            .unwrap();
        let small = shrink(&png, THUMB_WIDTH, 76).unwrap();
        let back = image::load_from_memory(&small).unwrap();
        assert_eq!((back.width(), back.height()), (720, 360));
    }
}
