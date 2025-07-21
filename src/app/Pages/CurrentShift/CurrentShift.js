import './CurrentShift.css';
import CurrentShiftService from './../../Services/app/CurrentShiftservice';

const Home = () => {
  return (
    <div className="pages">
      <div className="pagecontents">
        <div className="left-labels">
          <div className="body" style={{ padding: '5px', background: '#fff', minHeight: '100vh' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
              }}
            >
              <h5 className="head"><b>Current Shift Dashboard</b></h5>
            </div>

            <div className="iframe-panels">
              {(() => {
                const iframeUrl = `http://demo.yantra24x7.com:3000/d/b9090bd3-9bda-44dd-bce0-3cda6d3449e5/mm-dashboard-current-dashboard?orgId=1&theme=light&from=1750213168354&to=1750234768354&kiosk`;
                console.log(`Iframe URL:`, iframeUrl);

                return (
                  <div>
                    <iframe
                      title={`Grafana Panel`}
                      src={iframeUrl}
                      width="100%"
                      height="500%"
                      frameBorder="0"
                      allowFullScreen
                    ></iframe>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
