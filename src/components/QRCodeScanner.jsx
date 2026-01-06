import { Html5Qrcode } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';

export const QRCodeScanner = ({ onScanSuccess, onError, onClose }) => {
  const [isScanning, setIsScanning] = useState(false);
  const qrScannerRef = useRef(null);
  const [cameraId, setCameraId] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // カメラの初期化
    const initializeScanner = async () => {
      try {
        // 利用可能なカメラを取得
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
          setAvailableCameras(devices);
          setCameraId(devices[0].id);
          setIsInitialized(true);
        } else {
          onError('利用可能なカメラが見つかりませんでした');
        }
      } catch (err) {
        console.error('カメラの取得に失敗しました:', err);
        onError('カメラへのアクセスに失敗しました。カメラの使用が許可されているか確認してください。');
      }
    };

    initializeScanner();

    return () => {
      // コンポーネントのクリーンアップ時にスキャナーを停止
      if (qrScannerRef.current && qrScannerRef.current.isScanning) {
        qrScannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const startScanner = async () => {
    if (!cameraId) {
      onError('カメラが選択されていません');
      return;
    }

    try {
      qrScannerRef.current = new Html5Qrcode('qr-reader');
      
      await qrScannerRef.current.start(
        cameraId,
        {
          fps: 10,          // 1秒あたりのフレーム数
          qrbox: { width: 250, height: 250 }  // スキャンエリアのサイズ
        },
        (decodedText) => {
          // QRコードのスキャンに成功
          onScanSuccess(decodedText);
          // スキャン後に自動で停止
          stopScanner();
        },
        (errorMessage) => {
          // スキャンエラー（無視しても良い）
        }
      );
      
      setIsScanning(true);
    } catch (err) {
      console.error('QRコードスキャナーの起動に失敗しました:', err);
      onError('QRコードスキャナーの起動に失敗しました');
    }
  };

  const stopScanner = () => {
    if (qrScannerRef.current && qrScannerRef.current.isScanning) {
      qrScannerRef.current.stop()
        .then(() => {
          setIsScanning(false);
        })
        .catch(err => {
          console.error('スキャナーの停止に失敗しました:', err);
          onError('スキャナーの停止に失敗しました');
        });
    }
  };

  const handleCameraChange = (e) => {
    const newCameraId = e.target.value;
    setCameraId(newCameraId);
    
    // スキャン中であれば、新しいカメラで再起動
    if (isScanning) {
      stopScanner().then(() => {
        startScanner();
      });
    }
  };

  const handleStartStopClick = () => {
    if (isScanning) {
      stopScanner();
    } else {
      startScanner();
    }
  };

  return (
    <div className="qr-scanner-container">
      <div className="qr-scanner-header">
        <h3>QRコードスキャナー</h3>
        <button onClick={onClose} className="close-button">
          × 閉じる
        </button>
      </div>
      
      {availableCameras.length > 1 && (
        <div className="camera-selector">
          <label htmlFor="camera-select">カメラを選択: </label>
          <select 
            id="camera-select" 
            value={cameraId || ''} 
            onChange={handleCameraChange}
            disabled={isScanning}
          >
            {availableCameras.map(camera => (
              <option key={camera.id} value={camera.id}>
                {camera.label || `カメラ ${camera.id}`}
              </option>
            ))}
          </select>
        </div>
      )}
      
      <div id="qr-reader" className="qr-reader"></div>
      
      <div className="scanner-controls">
        <button 
          onClick={handleStartStopClick}
          className={`scan-button ${isScanning ? 'stop' : 'start'}`}
          disabled={!cameraId}
        >
          {isScanning ? 'スキャン停止' : 'スキャン開始'}
        </button>
        
        <div className="scanner-instructions">
          <p>QRコードをカメラにかざしてください</p>
          <p className="hint">※明るい場所で、コードがはっきり見えるようにしてください</p>
        </div>
      </div>
      
      <style jsx>{`
        .qr-scanner-container {
          position: relative;
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .qr-scanner-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background-color: #1a73e8;
          color: white;
        }
        
        .close-button {
          background: none;
          border: none;
          color: white;
          font-size: 16px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
        }
        
        .close-button:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
        
        .camera-selector {
          padding: 12px 16px;
          background-color: #f5f5f5;
          border-bottom: 1px solid #e0e0e0;
        }
        
        #camera-select {
          padding: 6px 8px;
          border-radius: 4px;
          border: 1px solid #ccc;
          margin-left: 8px;
        }
        
        .qr-reader {
          width: 100%;
          height: 300px;
          position: relative;
          overflow: hidden;
          background-color: #000;
        }
        
        .scanner-controls {
          padding: 16px;
          text-align: center;
          background-color: #f9f9f9;
          border-top: 1px solid #eee;
        }
        
        .scan-button {
          padding: 10px 24px;
          font-size: 16px;
          font-weight: bold;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin-bottom: 12px;
          transition: background-color 0.2s;
        }
        
        .scan-button.start {
          background-color: #1a73e8;
        }
        
        .scan-button.stop {
          background-color: #d32f2f;
        }
        
        .scan-button:disabled {
          background-color: #9e9e9e;
          cursor: not-allowed;
        }
        
        .scan-button:not(:disabled):hover {
          opacity: 0.9;
        }
        
        .scanner-instructions {
          color: #555;
          font-size: 14px;
          margin-top: 8px;
        }
        
        .scanner-instructions .hint {
          font-size: 12px;
          color: #888;
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
};

export default QRCodeScanner;
