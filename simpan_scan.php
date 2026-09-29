<?php
// Menyalakan radar error agar pesan tampil jika terjadi kesalahan
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Izinkan akses API dari browser
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

include 'koneksi.php';

// Menerima payload JSON dari JavaScript
$data = json_decode(file_get_contents("php://input"));

// Jika payload teks scan ada, masukkan ke tabel database
if (!empty($data->raw_text)) {
    
    $raw_text = $conn->real_escape_string($data->raw_text);
    $waktu_scan = $conn->real_escape_string($data->waktu_scan);
    $detail_json = $conn->real_escape_string(json_encode($data->detail_json));

    // Eksekusi Insert
    $sql = "INSERT INTO riwayat_scan (raw_text, detail_json, waktu_scan) 
            VALUES ('$raw_text', '$detail_json', '$waktu_scan')";

    if ($conn->query($sql) === TRUE) {
        http_response_code(201);
        echo json_encode(array("status" => "success", "message" => "Data scan kayu terekam ke Server."));
    } else {
        http_response_code(503);
        echo json_encode(array("status" => "error", "message" => "Gagal merekam data: " . $conn->error));
    }
} else {
    http_response_code(400);
    echo json_encode(array("status" => "error", "message" => "Tidak ada data barcode yang dikirim."));
}

$conn->close();
?>