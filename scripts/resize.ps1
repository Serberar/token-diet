param([string]$In, [string]$Out, [int]$Max)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($In)
try {
  # EXIF orientation (tag 0x0112): System.Drawing ignores it, so photos would come out rotated.
  if ($img.PropertyIdList -contains 274) {
    $flip = @{ 2 = 'RotateNoneFlipX'; 3 = 'Rotate180FlipNone'; 4 = 'Rotate180FlipX'; 5 = 'Rotate90FlipX'
               6 = 'Rotate90FlipNone'; 7 = 'Rotate270FlipX'; 8 = 'Rotate270FlipNone' }[[int]$img.GetPropertyItem(274).Value[0]]
    if ($flip) { $img.RotateFlip($flip) }
  }
  $w = $img.Width; $h = $img.Height
  $edge = [Math]::Max($w, $h)
  if ($edge -le $Max) { "SKIP $w $h"; exit 0 }
  $s = $Max / $edge
  $nw = [int][Math]::Round($w * $s); $nh = [int][Math]::Round($h * $s)
  $bmp = New-Object System.Drawing.Bitmap $nw, $nh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $nw, $nh)
  $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  "OK $w $h $nw $nh"
} finally { $img.Dispose() }
