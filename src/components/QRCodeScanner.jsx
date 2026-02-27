// ./src/components/QRCodeScanner.js

import { Html5Qrcode } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react'; // アイコンを利用

// onScanSuccess, onError, onClose を props として受け取る
export const QRCodeScanner = ({ onScanSuccess, onError, onClose }) => {
  const [isScanning, setIsScanning] = useState(false);
  const qrScannerRef = useRef(null);
  const [cameraId, setCameraId] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);

  // このuseEffectはカメラの初期化とクリーンアップを担当
  useEffect(() => {
    const initializeScanner = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
          setAvailableCameras(devices);
          // 背面カメラがあれば優先的に選択
          const rearCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('背面'));
          setCameraId(rearCamera ? rearCamera.id : devices[0].id);
        } else {
          onError('利用可能なカメラが見つかりませんでした');
        }
      } catch (err) {
        console.error('カメラの取得に失敗しました:', err);
        onError('カメラへのアクセスに失敗しました。許可を確認してください。');
      }
    };

    initializeScanner();

    // コンポーネントが閉じられる時にスキャナーを確実に停止
    return () => {
      if (qrScannerRef.current && qrScannerRef.current.isScanning) {
        qrScannerRef.current.stop().catch(err => console.error("Scanner stop failed on cleanup", err));
      }
    };
  }, [onError]); // onErrorが変更された場合のみ再実行

  // スキャンを開始する関数
  const startScanner = async (selectedCameraId) => {
    if (!selectedCameraId) {
      onError('カメラが選択されていません');
      return;
    }

    // 既にスキャナーがあれば停止
    if (qrScannerRef.current && qrScannerRef.current.isScanning) {
      await qrScannerRef.current.stop();
    }
    
    qrScannerRef.current = new Html5Qrcode('qr-reader-container');
    
    try {
      await qrScannerRef.current.start(
        selectedCameraId,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // スキャン成功！ 親コンポーネントに通知
          onScanSuccess(decodedText);
        },
        (errorMessage) => { /* 失敗時は何もしない */ }
      );
      setIsScanning(true);
    } catch (err) {
      console.error('QRスキャナーの起動に失敗:', err);
      onError(`QRスキャナーの起動に失敗しました: ${err.name}`);
    }
  };

  // カメラが選択されたら自動でスキャンを開始
  useEffect(() => {
    if (cameraId) {
      startScanner(cameraId);
    }
  }, [cameraId]);

  // カメラ切り替えハンドラ
  const handleCameraChange = (e) => {
    const newCameraId = e.target.value;
    setCameraId(newCameraId); // これにより上のuseEffectがトリガーされる
  };

  return (
    <div className="qr-scanner-overlay">
      <div className="qr-scanner-modal">
        <div className="qr-scanner-header">
          <h3>📷 QRコード受付</h3>
          <button onClick={onClose} className="qr-scanner-close-button" aria-label="閉じる">
            <X size={24} />
          </button>
        </div>

        {availableCameras.length > 1 && (
          <div className="camera-selector">
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
              📹 カメラを選択
            </label>
            <select
              value={cameraId || ''}
              onChange={handleCameraChange}
              aria-label="カメラ選択"
            >
              {availableCameras.map(camera => (
                <option key={camera.id} value={camera.id}>
                  {camera.label || `カメラ ${camera.id.substring(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
        )}

        <div id="qr-reader-container" className="qr-reader-view"></div>

        <div className="scanner-instructions">
          <p>📱 選手のQRコードを枠内に収めてください</p>
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.5rem' }}>自動的にスキャンされます</p>
        </div>
      </div>
    </div>
  );
};

export default QRCodeScanner;