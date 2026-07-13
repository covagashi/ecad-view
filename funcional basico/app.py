import requests
import sys
import os
import json
import re
import urllib.parse

BASE_URL = "https://dataportal.eplan.com/api"

def get_pat():
    pat_file = 'eplan_pat.txt'
    try:
        with open(pat_file, 'r') as file:
            pat = file.read().strip()
        if not pat:
            raise ValueError("El archivo PAT está vacío")
    except FileNotFoundError:
        print(f"Archivo {pat_file} no encontrado. Crea un nuevo PAT.")
    except Exception as e:
        print(f"Error al leer el archivo PAT: {str(e)}.")
        
    return pat

def make_api_request(url, pat, method='GET', data=None):
    headers = {"Authorization": f"Bearer PAT:{pat}"}
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers)
        elif method == 'POST':
            response = requests.post(url, headers=headers, json=data)
        else:
            raise ValueError(f"Método HTTP no soportado: {method}")

        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error en la solicitud a {url}:")
        print(f"Código de estado: {e.response.status_code}")
        print(f"Mensaje de error: {e.response.text}")
        raise

def search_part_id(part_number, pat):
    url = f"{BASE_URL}/parts?search={part_number}&fuzziness=0"
    response = make_api_request(url, pat)
    
    if response['meta']['page']['total'] == 0:
        return None, None
    
    part_data = response['data'][0]
    part_id = part_data['id']
    description = part_data['attributes']['description']['en_US']
    return part_id, description

def get_part_info(part_id, pat):
    url = f"{BASE_URL}/parts/{part_id}"
    return make_api_request(url, pat)

def get_macro_info(macro_id, pat):
    url = f"{BASE_URL}/macros/{macro_id}"
    return make_api_request(url, pat)

def is_3d_macro(macro_info):
    if macro_info['data']['attributes']['name'].lower().endswith('3d'):
        return True
    
    preview_id = macro_info['data']['relationships']['preview']['data']['id']
    if preview_id.lower().endswith('3d.ema'):
        return True
    
    return False

def sanitize_filename(filename):
    # Remove invalid characters
    filename = re.sub(r'[<>:"/\\|?*]', '', filename)
    # Remove any non-ASCII characters
    filename = re.sub(r'[^\x00-\x7F]+', '', filename)
    # Replace spaces with underscores
    filename = filename.replace(' ', '_')
    # Truncate filename if it's too long
    max_length = 255
    if len(filename) > max_length:
        name, ext = os.path.splitext(filename)
        filename = name[:max_length-len(ext)] + ext
    return filename


def download_file(url, pat):
    headers = {"Authorization": f"Bearer PAT:{pat}"}
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        # Obtener el nombre del archivo del header Content-Disposition
        content_disposition = response.headers.get('Content-Disposition')
        if content_disposition and 'filename=' in content_disposition:
            filename = content_disposition.split('filename=')[1].strip('"')
        else:
            filename = url.split('/')[-1]
        
        # Eliminar caracteres no válidos para nombres de archivo
        filename = "".join(c for c in filename if c.isalnum() or c in '._- ')
        
        with open(filename, 'wb') as f:
            f.write(response.content)
        print(f"Archivo guardado como: {filename}")
        return True
    except requests.RequestException as e:
        print(f"Error al descargar el archivo:")
        print(f"Código de estado: {e.response.status_code}")
        print(f"Mensaje de error: {e.response.text}")
        return False
    except Exception as e:
        print(f"Error al guardar el archivo: {str(e)}")
        return False

def download_3d_macros(part_id, pat):
    print(f"Iniciando descarga de macros 3D para la parte con ID: {part_id}")
    
    try:
        part_info = get_part_info(part_id, pat)
        if 'graphic_macro' not in part_info['data']['relationships']:
            print("Esta parte no tiene una macro gráfica asociada.")
            return False
        
        macro_id = part_info['data']['relationships']['graphic_macro']['data']['id']
        macro_info = get_macro_info(macro_id, pat)

        print(f"Información de la macro: {json.dumps(macro_info, indent=2)}")

        if not is_3d_macro(macro_info):
            print("Este part number no tiene ninguna macro 3D relacionada.")
            return False
        
        print("Se ha encontrado una macro 3D. Intentando descargar variantes...")
        
        success = False
        for variant in macro_info['data']['relationships']['macro_variants']['data']:
            variant_id = variant['id']
            url = f"{BASE_URL}/download/e3d_data/{variant_id}"
            if download_file(url, pat):
                success = True
        
        if not success:
            print("No se pudo descargar ninguna variante 3D válida.")
        else:
            print("Descarga de macros 3D completada.")
        
        return success
    
    except requests.RequestException as e:
        print(f"Error: {str(e)}")
        return False

def download_part(part_id, pat, file_type):
    if file_type == 'dxf':
        url = f"{BASE_URL}/download/dxf_data/part/{part_id}"
        filename = f"part_{part_id}.zip"
        return download_file(url, filename, pat)
    elif file_type == '3d':
        return download_3d_macros(part_id, pat)

if __name__ == '__main__':
    pat = get_pat()
    while True:
        part_number = input("Por favor, ingrese el número de parte (o 'q' para salir): ")
        if part_number.lower() == 'q':
            print("Saliendo del programa...")
            break
        
        part_id, description = search_part_id(part_number, pat)
        if not part_id:
            print(f"No se encontró ninguna parte con el número {part_number}.")
            continue
        
        print(f"Se ha encontrado la parte: {part_number}")
        print(f"Descripción: {description}")
        
        action = input("¿Qué desea hacer? (dxf/3d): ").lower()
        while action not in ['dxf', '3d']:
            action = input("Por favor, ingrese 'dxf' o '3d': ").lower()
        
        try:
            success = download_part(part_id, pat, action)
            if not success:
                retry = input("¿Desea intentar con un nuevo PAT? (s/n): ")
                if retry.lower() == 's':
                    pat = get_pat()
                else:
                    print("Saliendo del programa...")
                    break
        except requests.RequestException as e:
            print(f"Error en la solicitud: {e}")
            retry = input("¿Desea intentar de nuevo? (s/n): ")
            if retry.lower() != 's':
                print("Saliendo del programa...")
                break
        print("\n")