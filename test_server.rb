require 'webrick'
require 'net/http'
require 'uri'
require 'pp'
require 'cgi'

include WEBrick

WEBrick::HTTPUtils::DefaultMimeTypes['js']="application/javascript"
s = HTTPServer.new(
  :Port            => 7000,
  :DocumentRoot    => '.'
)

trap("INT"){ s.shutdown }
s.start
