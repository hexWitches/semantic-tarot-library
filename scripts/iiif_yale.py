import argparse
from iiif_download import IIIFManifest, config

def run_download(url, output_folder, max_dimension):
    # Setup global configuration from the library
    config.max_size = max_dimension
    config.img_dir = output_folder
    
    manifest = IIIFManifest(url)
    manifest.download(save_dir=output_folder)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IIIF Downloader using iiif_download library")
    
    # Mandatory Argument: The Manifest URL
    parser.add_argument("url", nargs='?', default="default_url_here", help="The IIIF Manifest URL")
    
    # Optional Arguments
    parser.add_argument("-o", "--output", default="IIIF_Downloads", help="Directory name for the images")
    parser.add_argument("-s", "--size", type=int, default=2500, help="Maximum dimension (width/height) for images")

    args = parser.parse_args()

    run_download(args.url, args.output, args.size)